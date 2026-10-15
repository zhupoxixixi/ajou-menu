"""Optional scheduled-job heartbeat. No external request unless explicitly enabled."""
import os
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen


def report():
    if os.environ.get('ENABLE_HEALTHCHECKS', 'false').lower() != 'true':
        print('External healthcheck is disabled.')
        return
    url = urlsplit(os.environ.get('HEALTHCHECK_PING_URL', ''))
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.fragment:
        raise ValueError('Set a valid HTTPS HEALTHCHECK_PING_URL secret before enabling healthchecks.')
    failed = os.environ.get('MENU_JOB_STATUS') != 'success'
    path = url.path.rstrip('/') + ('/fail' if failed else '')
    endpoint = urlunsplit((url.scheme, url.netloc, path, url.query, ''))
    try:
        with urlopen(Request(endpoint, data=b'', method='POST'), timeout=15) as response:
            if response.status >= 400:
                raise RuntimeError('External healthcheck returned an error.')
    except Exception:
        # Never include the secret monitor URL in workflow logs.
        raise RuntimeError('External healthcheck request failed.') from None
    print('Task result reported to the configured monitor.')


if __name__ == '__main__':
    report()
