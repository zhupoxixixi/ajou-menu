"""Shared, bounded chat requests with diagnostics that never contain secrets."""
import json
import threading
import time

import requests

_CLIENTS = threading.local()


class AIRequestError(RuntimeError):
    """Safe API or validation failure, without headers or response bodies."""


def _session() -> requests.Session:
    if not hasattr(_CLIENTS, 'session'):
        _CLIENTS.session = requests.Session()
    return _CLIENTS.session


def request_batch(sources, api_key, api_endpoint, model, system_prompt, parse_response, *, reasoning_effort=None):
    endpoint = api_endpoint.rstrip('/')
    if not endpoint.endswith('/chat/completions'):
        endpoint += '/chat/completions'
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': json.dumps(sources, ensure_ascii=False)},
        ],
        'temperature': 0.1,
    }
    if model.startswith('gpt-6'):
        payload.pop('temperature', None)
        payload['reasoning_effort'] = 'none'
    if reasoning_effort:
        payload.pop('temperature', None)
        payload['reasoning_effort'] = reasoning_effort
    last_error = 'AI request failed'
    for attempt in range(3):
        delay = 2 ** attempt
        try:
            response = _session().post(endpoint, headers={'Authorization': f'Bearer {api_key}'}, json=payload, timeout=(10, 90))
            if response.status_code in (429, 500, 502, 503, 504):
                last_error = f'AI HTTP {response.status_code}'
                try:
                    delay = min(15, max(delay, float(response.headers.get('Retry-After', delay))))
                except ValueError:
                    pass
            elif not response.ok:
                raise AIRequestError(f'AI HTTP {response.status_code}')
            else:
                try:
                    content = response.json()['choices'][0]['message']['content']
                    return parse_response(content, sources)
                except (ValueError, KeyError, IndexError, TypeError, AIRequestError):
                    last_error = 'Invalid AI response'
        except requests.RequestException as error:
            last_error = f'AI network error: {type(error).__name__}'
        if attempt < 2:
            time.sleep(delay)
    raise AIRequestError(last_error)
