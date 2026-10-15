"""Regenerate the original bowl icon and social card; optional dev dependency: Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent


def icon(size):
    image = Image.new('RGB', (512, 512), '#111111')
    draw = ImageDraw.Draw(image)
    draw.ellipse((96, 96, 416, 416), fill='#116537', outline='white', width=12)
    draw.arc((158, 151, 354, 347), 0, 180, fill='white', width=10)
    draw.line((145, 249, 367, 249), fill='white', width=10)
    draw.line((209, 365, 303, 365), fill='white', width=10)
    for x, top in [(207, 174), (256, 156), (305, 174)]:
        draw.line((x, top, x, 216), fill='white', width=9)
    return image.resize((size, size), Image.Resampling.LANCZOS)


def font(size, bold=False):
    paths = [Path('C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc'),
             Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')]
    for path in paths:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size=size)


if __name__ == '__main__':
    for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
        icon(size).save(ROOT / name, optimize=True)
    card = Image.new('RGB', (1200, 630), '#111111')
    draw = ImageDraw.Draw(card)
    card.paste(icon(220), (70, 70))
    draw.text((78, 335), 'AJOU MENU', fill='#ffffff', font=font(68, bold=True))
    draw.text((82, 446), '亚洲大学食堂 · 中韩双语菜单', fill='#bfe2ca', font=font(36))
    draw.text((84, 534), 'zhupoxixixi.github.io/ajou-menu', fill='#aaaaaa', font=font(23))
    card.save(ROOT / 'share.png', optimize=True)
