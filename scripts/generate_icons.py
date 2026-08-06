"""Generate Al-Mawaid launcher icons from the app logo.

Creates:
  - Legacy launcher icons (ic_launcher.png) for API < 26 devices
  - Legacy round icons (ic_launcher_round.png)
  - Adaptive icon foregrounds (ic_launcher_foreground.png) with safe-zone padding
All generated from public/al-mawaid.png composited on the brand navy (#060d1a).
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

LOGO_PATH = os.path.join(ROOT, "public", "al-mawaid.png")
NAVY = (6, 13, 26, 255)  # #060d1a

logo = Image.open(LOGO_PATH).convert("RGBA")

# Density -> legacy icon size in px
LEGACY_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# Density -> adaptive foreground size in px (108dp equivalent)
FOREGROUND_SIZES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}


def make_legacy(size):
    """Full logo composited on brand navy, sized for legacy launcher icon."""
    canvas = Image.new("RGBA", (size, size), NAVY)
    content = int(size * 0.84)  # logo canvas scaled to ~84% of icon
    scaled = logo.resize((content, content), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - content) // 2, (size - content) // 2))
    return canvas


def make_round(size):
    """Round-masked legacy icon."""
    icon = make_legacy(size)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    icon.putalpha(mask)
    return icon


def make_foreground(size):
    """Logo on transparent canvas with safe-zone padding (central ~72%)."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    content = int(size * 0.72)
    scaled = logo.resize((content, content), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - content) // 2, (size - content) // 2))
    return canvas


for folder, size in LEGACY_SIZES.items():
    d = os.path.join(RES, folder)
    make_legacy(size).save(os.path.join(d, "ic_launcher.png"))
    make_round(size).save(os.path.join(d, "ic_launcher_round.png"))
    print("wrote", folder, "ic_launcher.png", f"{size}x{size}")

for folder, size in FOREGROUND_SIZES.items():
    d = os.path.join(RES, folder)
    make_foreground(size).save(os.path.join(d, "ic_launcher_foreground.png"))
    print("wrote", folder, "ic_launcher_foreground.png", f"{size}x{size}")

print("Done.")
