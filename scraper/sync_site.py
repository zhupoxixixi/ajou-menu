"""Keep the legacy site/ directory in sync with the root deployment."""
from pathlib import Path
import shutil

ASSETS = ('index.html', 'styles.css', 'menu.js', 'menu-data.js', 'favicon.svg', 'THIRD_PARTY_NOTICES.md')


def sync_site(base_dir: Path | None = None):
    base_dir = base_dir or Path(__file__).resolve().parent.parent
    target = base_dir / 'site'
    target.mkdir(exist_ok=True)
    for name in ASSETS:
        shutil.copyfile(base_dir / name, target / name)


if __name__ == '__main__':
    sync_site()
