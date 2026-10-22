"""Regenerate the white bowl on System Blue and its social card with Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SYSTEM_BLUE = '#0088FF'


def icon(size):
    image = Image.new('RGB', (1024, 1024), SYSTEM_BLUE)
    draw = ImageDraw.Draw(image)
    # Same 32-unit geometry as the inline logo and favicon, inside the maskable safe zone.
    point = lambda x, y: (128 + 24 * x, 128 + 24 * y)
    def curve(a, b, c, d):
        return [point(*(((1 - t) ** 3 * a[i] + 3 * (1 - t) ** 2 * t * b[i]
                         + 3 * (1 - t) * t ** 2 * c[i] + t ** 3 * d[i]) for i in (0, 1)))
                for t in (n / 64 for n in range(65))]
    # Filled outer/inner contours avoid the seams from many thick line joins.
    outer = [point(4.1, 13.1), point(27.9, 13.1)]
    outer += curve((27.9, 13.1), (27.9, 20.9), (22.7, 25.9), (16, 25.9))[1:]
    outer += curve((16, 25.9), (9.3, 25.9), (4.1, 20.9), (4.1, 13.1))[1:]
    inner = [point(5.9, 14.9), point(26.1, 14.9)]
    inner += curve((26.1, 14.9), (25.7, 20.3), (21.5, 24.1), (16, 24.1))[1:]
    inner += curve((16, 24.1), (10.5, 24.1), (6.3, 20.3), (5.9, 14.9))[1:]
    draw.polygon(outer, fill='white')
    draw.polygon(inner, fill=SYSTEM_BLUE)
    width = 43
    for x in (12, 20):
        draw.line([point(x, 5), point(x, 9)], fill='white', width=width)
        for y in (5, 9):
            px, py = point(x, y)
            radius = width / 2
            draw.ellipse((px - radius, py - radius, px + radius, py + radius), fill='white')
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
    card = Image.new('RGB', (1200, 630), '#e0e0e0')
    draw = ImageDraw.Draw(card)
    tile_mask = Image.new('L', (220, 220), 0)
    ImageDraw.Draw(tile_mask).rounded_rectangle((0, 0, 219, 219), radius=48, fill=255)
    card.paste(icon(220), (70, 70), tile_mask)
    draw.text((78, 335), 'AJOU MENU', fill='#25352e', font=font(68, bold=True))
    draw.text((82, 446), '亚洲大学食堂 · 中韩双语菜单', fill='#59665f', font=font(36))
    draw.text((84, 534), 'zhupoxixixi.github.io/ajou-menu', fill='#59665f', font=font(23))
    card.save(ROOT / 'share.png', optimize=True)
