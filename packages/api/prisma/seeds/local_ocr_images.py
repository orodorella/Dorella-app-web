"""OCR local reanudable para los ZIP de imágenes con referencia visible."""

from __future__ import annotations

import csv
import json
import re
import shutil
import sys
import unicodedata
import zipfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

from PIL import Image
from rapidocr import RapidOCR


SCRIPT_DIR = Path(__file__).resolve().parent
ZIPS_DIR = SCRIPT_DIR / "input" / "zips"
EXTRACTED_DIR = SCRIPT_DIR / "input" / "con_texto"
OUTPUT_DIR = SCRIPT_DIR / "output" / "ocr_local"
STATE_DIR = SCRIPT_DIR / "output" / "estado_ocr_local"
PRODUCTS_SQL = SCRIPT_DIR / "03_products_insert.sql"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
FIELDS = ["numero", "archivo_original", "sku", "estado", "texto_ocr", "confianza"]


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")


def lot_name(zip_path: Path) -> str:
    name = normalize_name(zip_path.stem)
    return re.sub(r"(?:-con-texto|-sin-precio)(?:-\d+)?$", "", name).strip("-")


def natural_key(path: Path) -> list[object]:
    return [
        int(part) if part.isdigit() else part.casefold()
        for part in re.split(r"(\d+)", path.stem)
    ]


def find_images(directory: Path) -> list[Path]:
    images = [
        path for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    return sorted(images, key=lambda path: natural_key(path.relative_to(directory)))


def extract_safely(zip_path: Path, destination: Path) -> None:
    marker = destination / ".ocr_extracted.json"
    signature = {"name": zip_path.name, "size": zip_path.stat().st_size}
    if marker.exists():
        try:
            if json.loads(marker.read_text(encoding="utf-8")) == signature:
                return
        except (OSError, json.JSONDecodeError):
            pass

    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    root = destination.resolve()
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            target = (destination / member.filename).resolve()
            if target != root and root not in target.parents:
                raise ValueError(f"Ruta insegura en {zip_path.name}: {member.filename}")
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)
    marker.write_text(json.dumps(signature), encoding="utf-8")


def known_skus() -> set[str]:
    content = PRODUCTS_SQL.read_text(encoding="utf-8")
    return set(re.findall(r"\(gen_random_uuid\(\), '([^']+)'", content))


SKUS = known_skus()


def confusion_key(value: str) -> str:
    return value.upper().replace("O", "0")


def resolve_sku(value: str) -> str:
    normalized = re.sub(r"[^A-Z0-9_-]", "", value.upper())
    if normalized in SKUS:
        return normalized
    candidates = [sku for sku in SKUS if confusion_key(sku) == confusion_key(normalized)]
    return candidates[0] if len(candidates) == 1 else normalized


def candidate_texts(ocr: RapidOCR, image: Image.Image) -> list[tuple[str, float]]:
    width, height = image.size
    crops = [
        image,
        image.crop((int(width * 0.40), int(height * 0.60), width, height)),
        image.crop((0, int(height * 0.60), width, height)),
        image.crop((0, 0, width, int(height * 0.40))),
    ]
    candidates: list[tuple[str, float]] = []
    for crop in crops:
        result = ocr(crop)
        for text, score in zip(result.txts or (), result.scores or ()):
            normalized = re.sub(r"[^A-Z0-9_-]", "", text.upper())
            if re.search(r"[A-Z].*\d", normalized):
                candidates.append((normalized, float(score)))
    return candidates


def recognize(ocr: RapidOCR, image_path: Path) -> tuple[str, str, str, float]:
    with Image.open(image_path) as source:
        candidates = candidate_texts(ocr, source.convert("RGB"))
    if not candidates:
        return "NO_SKU", "sin_sku", "", 0.0

    evaluated = [
        (resolved in SKUS, score, resolved, raw)
        for raw, score in candidates
        for resolved in [resolve_sku(raw)]
    ]
    valid = [item for item in evaluated if item[0]]
    best = max(valid or evaluated, key=lambda item: item[1])
    _, confidence, sku, raw = best
    return sku, "ok" if sku in SKUS else "revisar", raw, confidence


def read_checkpoint(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    with path.open(newline="", encoding="utf-8") as file:
        return {row["archivo_original"]: row for row in csv.DictReader(file)}


def write_checkpoint(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    with temporary.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def unique_path(directory: Path, filename: str) -> Path:
    candidate = directory / filename
    counter = 2
    while candidate.exists():
        candidate = directory / f"{Path(filename).stem}_{counter}{Path(filename).suffix}"
        counter += 1
    return candidate


def process_lot(ocr: RapidOCR, zip_path: Path, lot: str) -> dict[str, object]:
    extracted = EXTRACTED_DIR / f"ocr-{lot}"
    extract_safely(zip_path, extracted)
    images = find_images(extracted)
    checkpoint_path = STATE_DIR / f"{lot}.csv"
    previous = read_checkpoint(checkpoint_path)
    rows: list[dict[str, object]] = []

    for index, image_path in enumerate(images, start=1):
        relative = image_path.relative_to(extracted).as_posix()
        saved = previous.get(relative)
        if saved:
            rows.append(saved)
            print(f"[{lot} {index}/{len(images)}] {relative} → {saved['sku']} (guardado)")
            continue

        sku, state, raw, confidence = recognize(ocr, image_path)
        row = {
            "numero": index,
            "archivo_original": relative,
            "sku": sku,
            "estado": state,
            "texto_ocr": raw,
            "confianza": f"{confidence:.5f}",
        }
        rows.append(row)
        write_checkpoint(checkpoint_path, rows)
        print(f"[{lot} {index}/{len(images)}] {relative} → {sku} ({state})")

    lot_output = OUTPUT_DIR / lot
    if lot_output.exists():
        shutil.rmtree(lot_output)
    lot_output.mkdir(parents=True)
    for row, image_path in zip(rows, images):
        prefix = "REVISAR_" if row["estado"] == "revisar" else ""
        if row["estado"] == "sin_sku":
            prefix = "SIN_SKU_"
        filename = f"{prefix}{row['sku']}_{int(row['numero']):04d}{image_path.suffix.lower()}"
        shutil.copy2(image_path, unique_path(lot_output, filename))

    return {
        "lote": lot,
        "total": len(rows),
        "ok": sum(row["estado"] == "ok" for row in rows),
        "sin_sku": sum(row["estado"] == "sin_sku" for row in rows),
        "revisar": sum(row["estado"] == "revisar" for row in rows),
    }


def main() -> None:
    zip_files = sorted(ZIPS_DIR.glob("*.zip"), key=natural_key)
    if not zip_files:
        raise FileNotFoundError(f"No hay ZIP en {ZIPS_DIR}")

    ocr = RapidOCR()
    summaries = []
    used_names: set[str] = set()
    for zip_path in zip_files:
        base = lot_name(zip_path) or "lote"
        lot = base
        suffix = 2
        while lot in used_names:
            lot = f"{base}-{suffix}"
            suffix += 1
        used_names.add(lot)
        print(f"\n=== {zip_path.name} → {lot} ===")
        summaries.append(process_lot(ocr, zip_path, lot))

    summary_path = OUTPUT_DIR / "resumen.json"
    summary_path.write_text(
        json.dumps(summaries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nResumen: {summary_path}")


if __name__ == "__main__":
    main()
