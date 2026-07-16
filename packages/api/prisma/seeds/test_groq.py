# pip install groq python-dotenv Pillow
# python test_groq.py

import base64
import os
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
from groq import Groq

SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = SCRIPT_DIR / ".." / ".." / ".." / ".." / ".env"
INPUT_DIR = SCRIPT_DIR / "input" / "con_texto" / "zip 1"
MAX_IMAGES = 3

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


def natural_sort_key(path: Path):
    return [
        int(part) if part.isdigit() else part
        for part in re.split(r"(\d+)", path.stem)
    ]


def find_images(directory: Path, limit: int) -> list[Path]:
    images = [
        path
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    images.sort(key=natural_sort_key)
    if not images:
        raise FileNotFoundError(f"No se encontró ninguna imagen en {directory}")
    return images[:limit]


def encode_image_base64(image_path: Path) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def detect_sku(client: Groq, image_path: Path) -> str:
    mime_type = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
    image_base64 = encode_image_base64(image_path)

    response = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
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


def main():
    load_dotenv(dotenv_path=ENV_PATH)

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(f"GROQ_API_KEY no encontrada en {ENV_PATH}")

    images = find_images(INPUT_DIR, MAX_IMAGES)
    client = Groq(api_key=api_key)

    results = []
    total = len(images)
    for i, image_path in enumerate(images, start=1):
        sku = detect_sku(client, image_path)
        marker = "✓" if sku != "NO_SKU" else "✗"
        print(f"[{i}/{total}] {image_path.name} → {sku} {marker}")
        results.append((image_path.name, sku))

    print("\n--- Mapeo completo ---")
    for name, sku in results:
        print(f"{name} → {sku}")


if __name__ == "__main__":
    main()
