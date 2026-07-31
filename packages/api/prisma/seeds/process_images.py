"""Procesa lotes de imágenes de productos y detecta sus SKU con Groq Vision.

Instalación:
    pip install groq python-dotenv

Flujo recomendado:
    1. Copiar pares de ZIP a ``input/zips``:
       lote-01-con-texto.zip / lote-01-sin-texto.zip
    2. Ejecutar:
       python process_images.py --process-zips

El proceso es reanudable: cada resultado se guarda inmediatamente y las imágenes
con estado ``ok`` o ``sin_sku`` no vuelven a consumir una petición.
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import random
import re
import shutil
import sys
import time
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
from groq import Groq


SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = SCRIPT_DIR.parents[3] / ".env"
INPUT_DIR = SCRIPT_DIR / "input"
ZIPS_DIR = INPUT_DIR / "zips"
OUTPUT_DIR = SCRIPT_DIR / "output"
STATE_DIR = OUTPUT_DIR / "estado"
PRODUCTS_SQL = SCRIPT_DIR / "03_products_insert.sql"

MODEL = "qwen/qwen3.6-27b"
PROMPT = (
    "Esta es una foto de una joya. Busca un código de referencia en la imagen, "
    "generalmente en una esquina. El código tiene letras seguidas de números; "
    "ejemplos: CA45016, TOL001, DIJ023. Responde ÚNICAMENTE el código exacto, "
    "sin espacios ni caracteres extra. Si no encuentras un código responde "
    "exactamente: NO_SKU."
)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
FINAL_STATES = {"ok", "sin_sku", "revisar"}
CSV_FIELDS = [
    "numero",
    "archivo_original",
    "sku_detectado",
    "estado",
    "intentos",
    "error",
]


@dataclass(frozen=True)
class RateConfig:
    delay_seconds: float = 1.5
    batch_size: int = 10
    batch_delay_seconds: float = 5.0
    max_retries: int = 6
    max_backoff_seconds: float = 60.0


def natural_sort_key(path: Path) -> list[object]:
    return [
        int(part) if part.isdigit() else part.casefold()
        for part in re.split(r"(\d+)", path.stem)
    ]


def find_images(directory: Path) -> list[Path]:
    if not directory.is_dir():
        return []
    images = [
        path
        for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    images.sort(key=lambda path: natural_sort_key(path.relative_to(directory)))
    return images


def normalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "-", normalized.casefold()).strip("-")


def classify_zip(path: Path) -> tuple[str, str] | None:
    stem = normalize_name(path.stem)
    for suffix, kind in (
        ("-con-texto", "con_texto"),
        ("-sin-texto", "sin_texto"),
        ("-contexto", "con_texto"),
        ("-sintexto", "sin_texto"),
    ):
        if stem.endswith(suffix):
            return stem[: -len(suffix)].strip("-"), kind
    return None


def discover_zip_pairs(zips_dir: Path) -> list[tuple[str, Path, Path]]:
    grouped: dict[str, dict[str, Path]] = {}
    unknown: list[str] = []

    for path in sorted(zips_dir.glob("*.zip"), key=natural_sort_key):
        classification = classify_zip(path)
        if classification is None:
            unknown.append(path.name)
            continue
        lot, kind = classification
        if not lot:
            unknown.append(path.name)
            continue
        if kind in grouped.setdefault(lot, {}):
            raise ValueError(f"Hay más de un ZIP {kind} para el lote '{lot}'")
        grouped[lot][kind] = path

    if unknown:
        print("Aviso: se ignoraron ZIP sin nombre reconocible: " + ", ".join(unknown))

    incomplete = [
        lot for lot, files in grouped.items()
        if "con_texto" not in files or "sin_texto" not in files
    ]
    if incomplete:
        details = ", ".join(
            f"{lot} ({', '.join(sorted(grouped[lot]))})" for lot in incomplete
        )
        raise ValueError(f"Hay lotes sin su par de ZIP: {details}")

    return [
        (lot, files["con_texto"], files["sin_texto"])
        for lot, files in sorted(grouped.items())
    ]


def safe_extract(zip_path: Path, destination: Path, force: bool = False) -> None:
    marker = destination / ".extracted.json"
    signature = {
        "zip": zip_path.name,
        "size": zip_path.stat().st_size,
        "mtime_ns": zip_path.stat().st_mtime_ns,
    }

    if not force and marker.exists():
        try:
            if json.loads(marker.read_text(encoding="utf-8")) == signature:
                return
        except (OSError, json.JSONDecodeError):
            pass

    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    destination_root = destination.resolve()

    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            target = (destination / member.filename).resolve()
            if destination_root != target and destination_root not in target.parents:
                raise ValueError(f"Ruta insegura dentro de {zip_path.name}: {member.filename}")
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)

    marker.write_text(json.dumps(signature), encoding="utf-8")


def get_groq_client() -> Groq:
    load_dotenv(dotenv_path=ENV_PATH)
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(f"GROQ_API_KEY no encontrada en {ENV_PATH}")
    return Groq(api_key=api_key)


def encode_image_base64(image_path: Path) -> str:
    with image_path.open("rb") as file:
        return base64.b64encode(file.read()).decode("utf-8")


def image_mime_type(path: Path) -> str:
    return {
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "image/jpeg")


def normalize_sku(raw_value: str | None) -> str:
    if not raw_value:
        return "NO_SKU"
    value = raw_value.strip().upper()
    if "NO_SKU" in value:
        return "NO_SKU"
    match = re.search(r"\b[A-Z][A-Z0-9]*(?:[-_][A-Z0-9]+)*\b", value)
    return match.group(0) if match else "NO_SKU"


def load_known_skus() -> set[str]:
    if not PRODUCTS_SQL.exists():
        return set()
    content = PRODUCTS_SQL.read_text(encoding="utf-8")
    return set(re.findall(r"\(gen_random_uuid\(\), '([^']+)'", content))


KNOWN_SKUS = load_known_skus()


def sku_confusion_key(sku: str) -> str:
    # OCR suele confundir la letra O con el número 0. Sólo se corrige cuando
    # existe exactamente un SKU conocido con la misma representación.
    return sku.upper().replace("O", "0")


def resolve_known_sku(sku: str) -> str:
    if sku in KNOWN_SKUS:
        return sku
    key = sku_confusion_key(sku)
    candidates = [known for known in KNOWN_SKUS if sku_confusion_key(known) == key]
    return candidates[0] if len(candidates) == 1 else sku


def detect_sku(client: Groq, image_path: Path) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        temperature=0,
        max_completion_tokens=30,
        reasoning_effort="none",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": (
                                f"data:{image_mime_type(image_path)};base64,"
                                f"{encode_image_base64(image_path)}"
                            )
                        },
                    },
                ],
            }
        ],
    )
    return resolve_known_sku(normalize_sku(response.choices[0].message.content))


def error_status(exc: Exception) -> int | None:
    status = getattr(exc, "status_code", None)
    if isinstance(status, int):
        return status
    response = getattr(exc, "response", None)
    response_status = getattr(response, "status_code", None)
    return response_status if isinstance(response_status, int) else None


def retry_after_seconds(exc: Exception) -> float | None:
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", {}) or {}
    value = headers.get("retry-after")
    if value is None:
        return None
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return None


def is_retryable(exc: Exception) -> bool:
    status = error_status(exc)
    return status is None or status == 408 or status == 429 or status >= 500


def detect_with_retries(
    client: Groq,
    image_path: Path,
    config: RateConfig,
) -> tuple[str, int]:
    for attempt in range(1, config.max_retries + 1):
        try:
            return detect_sku(client, image_path), attempt
        except Exception as exc:
            if not is_retryable(exc) or attempt == config.max_retries:
                raise
            header_delay = retry_after_seconds(exc)
            backoff = min(config.max_backoff_seconds, 2 ** (attempt - 1))
            wait = header_delay if header_delay is not None else backoff + random.uniform(0, 1)
            print(
                f"  Límite/error temporal ({error_status(exc) or 'red'}). "
                f"Reintento {attempt + 1}/{config.max_retries} en {wait:.1f}s"
            )
            time.sleep(wait)
    raise RuntimeError("Se agotaron los reintentos")


def read_state(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    with path.open(newline="", encoding="utf-8") as file:
        return {row["archivo_original"]: row for row in csv.DictReader(file)}


def write_state(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    with temporary.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def scan_lot(
    lot: str,
    image_dir: Path,
    config: RateConfig,
    force: bool = False,
) -> Path:
    images = find_images(image_dir)
    if not images:
        raise FileNotFoundError(f"No se encontraron imágenes en {image_dir}")

    state_path = STATE_DIR / f"mapeo_{lot}.csv"
    previous = {} if force else read_state(state_path)
    rows: list[dict[str, Any]] = []
    client: Groq | None = None
    api_calls = 0
    consecutive_errors = 0

    for index, image_path in enumerate(images, start=1):
        relative_name = image_path.relative_to(image_dir).as_posix()
        saved = previous.get(relative_name)
        if saved and saved["estado"] in FINAL_STATES:
            corrected = resolve_known_sku(saved["sku_detectado"])
            saved["sku_detectado"] = corrected
            if corrected != "NO_SKU":
                saved["estado"] = "ok" if corrected in KNOWN_SKUS else "revisar"
            rows.append(saved)
            print(f"[{index}/{len(images)}] {relative_name} → {saved['sku_detectado']} (guardado)")
            continue

        if client is None:
            client = get_groq_client()

        try:
            sku, attempts = detect_with_retries(client, image_path, config)
            if sku == "NO_SKU":
                state = "sin_sku"
            elif sku in KNOWN_SKUS:
                state = "ok"
            else:
                state = "revisar"
            error = ""
        except Exception as exc:
            sku = "ERROR"
            attempts = config.max_retries
            state = "error"
            error = str(exc)[:500]

        row = {
            "numero": index,
            "archivo_original": relative_name,
            "sku_detectado": sku,
            "estado": state,
            "intentos": attempts,
            "error": error,
        }
        rows.append(row)
        write_state(state_path, rows)
        api_calls += 1
        print(f"[{index}/{len(images)}] {relative_name} → {sku} ({state})")

        if state == "error":
            consecutive_errors += 1
            if consecutive_errors >= 3:
                raise RuntimeError(
                    "Se detuvo el lote después de 3 errores consecutivos. "
                    f"Último error: {error}"
                )
        else:
            consecutive_errors = 0

        if index != len(images):
            time.sleep(config.delay_seconds)
            if api_calls % config.batch_size == 0:
                time.sleep(config.batch_delay_seconds)

    write_state(state_path, rows)
    return state_path


def unique_destination(directory: Path, sku: str, extension: str) -> Path:
    candidate = directory / f"{sku}{extension.lower()}"
    counter = 2
    while candidate.exists():
        candidate = directory / f"{sku}_{counter}{extension.lower()}"
        counter += 1
    return candidate


def rename_lot(lot: str, clean_dir: Path, mapping_path: Path, force: bool = False) -> Path:
    clean_images = find_images(clean_dir)
    with mapping_path.open(newline="", encoding="utf-8") as file:
        mappings = list(csv.DictReader(file))

    if len(clean_images) != len(mappings):
        raise ValueError(
            f"El lote '{lot}' no coincide: {len(mappings)} con texto y "
            f"{len(clean_images)} sin texto. No se renombró nada."
        )

    lot_output = OUTPUT_DIR / "imagenes" / lot
    # El resultado es derivado del checkpoint: se reconstruye para no duplicar
    # archivos (_2, _3...) al reanudar un lote ya escaneado.
    if lot_output.exists():
        shutil.rmtree(lot_output)
    lot_output.mkdir(parents=True, exist_ok=True)
    unresolved = lot_output / "sin_sku"
    unresolved.mkdir(exist_ok=True)
    result_rows: list[dict[str, Any]] = []

    for index, (mapping, clean_image) in enumerate(zip(mappings, clean_images), start=1):
        sku = mapping["sku_detectado"]
        if mapping["estado"] == "ok" and sku not in {"NO_SKU", "ERROR"}:
            destination = unique_destination(lot_output, sku, clean_image.suffix)
            final_state = "ok"
        else:
            destination = unique_destination(
                unresolved,
                clean_image.stem,
                clean_image.suffix,
            )
            final_state = "sin_sku"
        shutil.copy2(clean_image, destination)
        result_rows.append({
            "numero": index,
            "archivo_original": clean_image.relative_to(clean_dir).as_posix(),
            "sku_detectado": sku,
            "estado": final_state,
            "intentos": mapping.get("intentos", ""),
            "error": mapping.get("error", ""),
        })

    result_path = STATE_DIR / f"resultado_{lot}.csv"
    write_state(result_path, result_rows)
    return result_path


def process_zip_pairs(zips_dir: Path, config: RateConfig, force: bool = False) -> None:
    if not zips_dir.is_dir():
        zips_dir.mkdir(parents=True, exist_ok=True)
        raise FileNotFoundError(
            f"Se creó {zips_dir}. Copia allí los pares de ZIP y vuelve a ejecutar."
        )

    pairs = discover_zip_pairs(zips_dir)
    if not pairs:
        raise FileNotFoundError(f"No se encontraron pares de ZIP en {zips_dir}")

    summaries: list[dict[str, Any]] = []
    for number, (lot, with_text_zip, clean_zip) in enumerate(pairs, start=1):
        print(f"\n=== Lote {number}/{len(pairs)}: {lot} ===")
        with_text_dir = INPUT_DIR / "con_texto" / lot
        clean_dir = INPUT_DIR / "sin_texto" / lot
        safe_extract(with_text_zip, with_text_dir, force=force)
        safe_extract(clean_zip, clean_dir, force=force)

        with_text_count = len(find_images(with_text_dir))
        clean_count = len(find_images(clean_dir))
        if with_text_count != clean_count:
            summaries.append({
                "lote": lot,
                "estado": "cantidad_no_coincide",
                "con_texto": with_text_count,
                "sin_texto": clean_count,
            })
            print(
                f"ERROR: {with_text_count} imágenes con texto y "
                f"{clean_count} sin texto. Se omitió el lote."
            )
            continue

        mapping = scan_lot(lot, with_text_dir, config, force=force)
        result = rename_lot(lot, clean_dir, mapping, force=force)
        state = read_state(mapping)
        summaries.append({
            "lote": lot,
            "estado": "procesado",
            "imagenes": with_text_count,
            "ok": sum(row["estado"] == "ok" for row in state.values()),
            "sin_sku": sum(row["estado"] == "sin_sku" for row in state.values()),
            "errores": sum(row["estado"] == "error" for row in state.values()),
            "resultado": str(result),
        })

    OUTPUT_DIR.mkdir(exist_ok=True)
    summary_path = OUTPUT_DIR / "resumen_lotes.json"
    summary_path.write_text(
        json.dumps(summaries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nResumen general: {summary_path}")


def scan_text_zips(zips_dir: Path, config: RateConfig, force: bool = False) -> None:
    """Escanea ZIP independientes cuando sólo están disponibles las fotos con texto."""
    if not zips_dir.is_dir():
        raise FileNotFoundError(f"No existe el directorio {zips_dir}")

    zip_files = sorted(zips_dir.glob("*.zip"), key=natural_sort_key)
    if not zip_files:
        raise FileNotFoundError(f"No se encontraron ZIP en {zips_dir}")

    used_lots: set[str] = set()
    summaries: list[dict[str, Any]] = []
    for number, zip_path in enumerate(zip_files, start=1):
        lot = normalize_name(zip_path.stem)
        lot = re.sub(r"(?:-con-texto|-sin-precio)(?:-\d+)?$", "", lot).strip("-")
        original_lot = lot or f"lote-{number}"
        lot = original_lot
        suffix = 2
        while lot in used_lots:
            lot = f"{original_lot}-{suffix}"
            suffix += 1
        used_lots.add(lot)

        print(f"\n=== ZIP {number}/{len(zip_files)}: {zip_path.name} ({lot}) ===")
        image_dir = INPUT_DIR / "con_texto" / lot
        safe_extract(zip_path, image_dir, force=force)
        mapping = scan_lot(lot, image_dir, config, force=force)
        state = read_state(mapping)
        summaries.append({
            "lote": lot,
            "zip": zip_path.name,
            "imagenes": len(state),
            "ok": sum(row["estado"] == "ok" for row in state.values()),
            "sin_sku": sum(row["estado"] == "sin_sku" for row in state.values()),
            "errores": sum(row["estado"] == "error" for row in state.values()),
            "mapeo": str(mapping),
        })

    OUTPUT_DIR.mkdir(exist_ok=True)
    summary_path = OUTPUT_DIR / "resumen_identificacion.json"
    summary_path.write_text(
        json.dumps(summaries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nResumen de identificación: {summary_path}")


def legacy_scan(zip_name: str, config: RateConfig, force: bool) -> None:
    lot = normalize_name(zip_name)
    directory = INPUT_DIR / "con_texto" / zip_name
    mapping = scan_lot(lot, directory, config, force=force)
    legacy_path = INPUT_DIR / f"mapeo_{lot.replace('-', '')}.csv"
    shutil.copy2(mapping, legacy_path)
    print(f"Mapeo guardado en: {mapping}")


def legacy_rename(zip_name: str, force: bool) -> None:
    lot = normalize_name(zip_name)
    mapping = STATE_DIR / f"mapeo_{lot}.csv"
    if not mapping.exists():
        legacy = INPUT_DIR / f"mapeo_{lot.replace('-', '')}.csv"
        if legacy.exists():
            mapping = legacy
    result = rename_lot(
        lot,
        INPUT_DIR / "sin_texto" / zip_name,
        mapping,
        force=force,
    )
    print(f"Resultado guardado en: {result}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--process-zips", action="store_true")
    action.add_argument(
        "--scan-zips",
        action="store_true",
        help="Identifica SKU cuando sólo están disponibles los ZIP con texto",
    )
    action.add_argument("--scan", action="store_true")
    action.add_argument("--retry-errors", action="store_true")
    action.add_argument("--rename", action="store_true")
    parser.add_argument("--zip", help="Nombre del lote para comandos heredados")
    parser.add_argument("--zips-dir", type=Path, default=ZIPS_DIR)
    parser.add_argument("--force", action="store_true", help="Reprocesa y sobrescribe el lote")
    parser.add_argument("--delay", type=float, default=1.5)
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--batch-delay", type=float, default=5.0)
    parser.add_argument("--max-retries", type=int, default=6)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    config = RateConfig(
        delay_seconds=max(0, args.delay),
        batch_size=max(1, args.batch_size),
        batch_delay_seconds=max(0, args.batch_delay),
        max_retries=max(1, args.max_retries),
    )

    if args.process_zips:
        process_zip_pairs(args.zips_dir.resolve(), config, force=args.force)
        return
    if args.scan_zips:
        scan_text_zips(args.zips_dir.resolve(), config, force=args.force)
        return
    if not args.zip:
        raise SystemExit("--zip es obligatorio con --scan, --retry-errors o --rename")
    if args.rename:
        legacy_rename(args.zip, force=args.force)
    else:
        # --retry-errors reutiliza el checkpoint y sólo procesa filas no finalizadas.
        legacy_scan(args.zip, config, force=args.force if args.scan else False)


if __name__ == "__main__":
    main()
