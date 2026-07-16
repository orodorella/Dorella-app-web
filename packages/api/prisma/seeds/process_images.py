# pip install groq python-dotenv Pillow
#
# python process_images.py --scan --zip "zip 1"
# python process_images.py --retry-errors --zip "zip 1"
# python process_images.py --rename --zip "zip 1"

import argparse
import base64
import csv
import os
import re
import shutil
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
from groq import Groq

SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = SCRIPT_DIR / ".." / ".." / ".." / ".." / ".env"
INPUT_DIR = SCRIPT_DIR / "input"
OUTPUT_DIR = SCRIPT_DIR / "output"

MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

PROMPT = (
    "Esta es una foto de una joya. Busca un código de "
    "referencia en la imagen, generalmente en la esquina "
    "inferior derecha o izquierda. El código tiene letras "
    "seguidas de números, ejemplos: CA45016, TOL001, DIJ023. "
    "Responde ÚNICAMENTE el código exacto sin espacios ni "
    "caracteres extra. Si no encontrás ningún código responde "
    "exactamente: NO_SKU"
)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}

BATCH_SIZE = 5
BATCH_DELAY_SECONDS = 2


def natural_sort_key(path: Path):
    return [
        int(part) if part.isdigit() else part
        for part in re.split(r"(\d+)", path.stem)
    ]


def find_images(directory: Path) -> list[Path]:
    images = [
        path
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    images.sort(key=natural_sort_key)
    return images


def get_groq_client() -> Groq:
    load_dotenv(dotenv_path=ENV_PATH)
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(f"GROQ_API_KEY no encontrada en {ENV_PATH}")
    return Groq(api_key=api_key)


def encode_image_base64(image_path: Path) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def detect_sku(client: Groq, image_path: Path) -> str:
    mime_type = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
    image_base64 = encode_image_base64(image_path)

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_base64}"
                        },
                    },
                ],
            }
        ],
    )

    raw_response = response.choices[0].message.content
    return raw_response.strip() if raw_response else "NO_SKU"


def cmd_scan(zip_name: str):
    con_texto_dir = INPUT_DIR / "con_texto" / zip_name
    if not con_texto_dir.is_dir():
        raise FileNotFoundError(f"No existe la carpeta {con_texto_dir}")

    images = find_images(con_texto_dir)
    total = len(images)
    if total == 0:
        raise FileNotFoundError(f"No se encontraron imágenes en {con_texto_dir}")

    zip_slug = re.sub(r"\s+", "", zip_name).lower()
    mapeo_path = INPUT_DIR / f"mapeo_{zip_slug}.csv"

    client = get_groq_client()

    rows = []
    con_sku = 0
    sin_sku = 0
    errores = 0

    for i, image_path in enumerate(images, start=1):
        try:
            sku = detect_sku(client, image_path)
            if sku == "NO_SKU":
                estado = "sin_sku"
                marker = "⚠"
                sin_sku += 1
            else:
                estado = "ok"
                marker = "✓"
                con_sku += 1
        except Exception as exc:
            sku = "ERROR"
            estado = "error"
            marker = "✗"
            errores += 1
            print(f"[{i}/{total}] {image_path.name} → ERROR ({exc}) {marker}")
            rows.append((i, image_path.name, sku, estado))
        else:
            print(f"[{i}/{total}] {image_path.name} → {sku} {marker}")
            rows.append((i, image_path.name, sku, estado))

        if i % BATCH_SIZE == 0 and i != total:
            time.sleep(BATCH_DELAY_SECONDS)

    with open(mapeo_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["numero", "archivo_original", "sku_detectado", "estado"])
        writer.writerows(rows)

    print(f"\nMapeo guardado en: {mapeo_path}")
    print("\n--- Resumen ---")
    print(f"Total procesadas: {total}")
    print(f"Con SKU: {con_sku}")
    print(f"Sin SKU (revisar): {sin_sku}")
    if errores:
        print(f"Errores: {errores}")


def cmd_retry_errors(zip_name: str):
    con_texto_dir = INPUT_DIR / "con_texto" / zip_name
    if not con_texto_dir.is_dir():
        raise FileNotFoundError(f"No existe la carpeta {con_texto_dir}")

    zip_slug = re.sub(r"\s+", "", zip_name).lower()
    mapeo_path = INPUT_DIR / f"mapeo_{zip_slug}.csv"
    if not mapeo_path.exists():
        raise FileNotFoundError(
            f"No existe {mapeo_path}. Corré primero --scan --zip \"{zip_name}\""
        )

    with open(mapeo_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    error_indices = [i for i, row in enumerate(rows) if row["estado"] == "error"]
    total = len(error_indices)
    if total == 0:
        print("No hay filas con estado=error para reintentar.")
        return

    client = get_groq_client()

    con_sku = 0
    sin_sku = 0
    errores = 0

    for progress, idx in enumerate(error_indices, start=1):
        row = rows[idx]
        image_path = con_texto_dir / row["archivo_original"]

        try:
            sku = detect_sku(client, image_path)
            if sku == "NO_SKU":
                estado = "sin_sku"
                marker = "⚠"
                sin_sku += 1
            else:
                estado = "ok"
                marker = "✓"
                con_sku += 1
        except Exception as exc:
            sku = "ERROR"
            estado = "error"
            marker = "✗"
            errores += 1
            print(f"[{progress}/{total}] {image_path.name} → ERROR ({exc}) {marker}")
        else:
            print(f"[{progress}/{total}] {image_path.name} → {sku} {marker}")

        rows[idx]["sku_detectado"] = sku
        rows[idx]["estado"] = estado

        if progress % BATCH_SIZE == 0 and progress != total:
            time.sleep(BATCH_DELAY_SECONDS)

    with open(mapeo_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["numero", "archivo_original", "sku_detectado", "estado"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nMapeo actualizado en: {mapeo_path}")
    print("\n--- Resumen del reintento ---")
    print(f"Reintentadas: {total}")
    print(f"Resueltas con SKU: {con_sku}")
    print(f"Sin SKU: {sin_sku}")
    print(f"Siguen con error: {errores}")


def cmd_rename(zip_name: str):
    zip_slug = re.sub(r"\s+", "", zip_name).lower()
    mapeo_path = INPUT_DIR / f"mapeo_{zip_slug}.csv"
    if not mapeo_path.exists():
        raise FileNotFoundError(
            f"No existe {mapeo_path}. Corré primero --scan --zip \"{zip_name}\""
        )

    sin_texto_dir = INPUT_DIR / "sin_texto" / zip_name
    if not sin_texto_dir.is_dir():
        raise FileNotFoundError(f"No existe la carpeta {sin_texto_dir}")

    images = find_images(sin_texto_dir)
    if not images:
        raise FileNotFoundError(f"No se encontraron imágenes en {sin_texto_dir}")

    with open(mapeo_path, newline="", encoding="utf-8") as f:
        mapeo_rows = list(csv.DictReader(f))

    OUTPUT_DIR.mkdir(exist_ok=True)
    sin_sku_dir = OUTPUT_DIR / "sin_sku"
    sin_sku_dir.mkdir(exist_ok=True)

    resultado_rows = []
    total = min(len(mapeo_rows), len(images))
    con_sku = 0
    sin_sku = 0
    errores = 0

    for idx in range(total):
        mapeo_row = mapeo_rows[idx]
        image_path = images[idx]
        numero = mapeo_row["numero"]
        sku = mapeo_row["sku_detectado"]
        estado = mapeo_row["estado"]
        archivo_original = image_path.name
        ext = image_path.suffix

        try:
            if estado == "ok" and sku not in ("NO_SKU", "ERROR"):
                destino = OUTPUT_DIR / f"{sku}{ext}"
                shutil.copy2(image_path, destino)
                archivo_final = destino.name
                estado_final = "ok"
                marker = "✓"
                con_sku += 1
            else:
                destino = sin_sku_dir / archivo_original
                shutil.copy2(image_path, destino)
                archivo_final = f"sin_sku/{destino.name}"
                estado_final = "sin_sku"
                marker = "⚠"
                sin_sku += 1
        except Exception as exc:
            archivo_final = ""
            estado_final = "error"
            marker = "✗"
            errores += 1
            print(f"[{idx + 1}/{total}] {archivo_original} → ERROR ({exc}) {marker}")
            resultado_rows.append(
                (numero, sku, archivo_original, archivo_final, estado_final)
            )
            continue

        print(f"[{idx + 1}/{total}] {archivo_original} → {archivo_final} {marker}")
        resultado_rows.append(
            (numero, sku, archivo_original, archivo_final, estado_final)
        )

    resultado_path = OUTPUT_DIR / f"resultado_{zip_slug}.csv"
    with open(resultado_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["numero", "sku", "archivo_original", "archivo_final", "estado"])
        writer.writerows(resultado_rows)

    print(f"\nResultado guardado en: {resultado_path}")
    print("\n--- Resumen ---")
    print(f"Total procesadas: {total}")
    print(f"Con SKU: {con_sku}")
    print(f"Sin SKU (revisar): {sin_sku}")
    if errores:
        print(f"Errores: {errores}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scan", action="store_true")
    parser.add_argument("--retry-errors", action="store_true")
    parser.add_argument("--rename", action="store_true")
    parser.add_argument("--zip", required=True)
    args = parser.parse_args()

    if args.scan:
        cmd_scan(args.zip)
    elif args.retry_errors:
        cmd_retry_errors(args.zip)
    elif args.rename:
        cmd_rename(args.zip)
    else:
        parser.error("Debe especificar --scan, --retry-errors o --rename")


if __name__ == "__main__":
    main()
