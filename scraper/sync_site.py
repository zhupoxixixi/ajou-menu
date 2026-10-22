"""Keep the legacy site/ directory in sync with the root deployment."""
from pathlib import Path
import shutil

ASSETS = ('index.html', 'styles.css', 'menu.js', 'appearance.js', 'background.js', 'contrast.js',
          'menu-data.js', 'favicon.svg',
          'manifest.webmanifest', 'sw.js', 'apple-touch-icon.png', 'icon-192.png',
          'icon-512.png', 'share.png', '404.html', 'THIRD_PARTY_NOTICES.md')


def sync_site(base_dir: Path | None = None):
    base_dir = base_dir or Path(__file__).resolve().parent.parent
    target = base_dir / 'site'
    target.mkdir(exist_ok=True)
    for name in ASSETS:
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(base_dir / name, destination)


if __name__ == '__main__':
    sync_site()
