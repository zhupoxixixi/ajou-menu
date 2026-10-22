"""Bounded Responses/chat requests with diagnostics that never contain secrets."""
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


def _response_text(body, model, effort):
    if not isinstance(body, dict) or body.get('status') != 'completed':
        raise AIRequestError('Incomplete AI response')
    if body.get('model', model) != model:
        raise AIRequestError('Unexpected response model')
    reasoning = body.get('reasoning')
    if isinstance(reasoning, dict) and reasoning.get('effort', effort) != effort:
        raise AIRequestError('Unexpected response reasoning effort')
    output = body.get('output')
    if not isinstance(output, list):
        raise AIRequestError('Invalid response output')
    messages = [item for item in output if isinstance(item, dict) and item.get('type') == 'message' and item.get('role') == 'assistant']
    if len(messages) != 1:
        raise AIRequestError('Ambiguous response messages')
    message = messages[0]
    if message.get('status') != 'completed' or message.get('phase') not in (None, 'final_answer'):
        raise AIRequestError('Incomplete response message')
    parts = message.get('content')
    if not isinstance(parts, list) or not parts or not all(isinstance(part, dict) and part.get('type') == 'output_text' and isinstance(part.get('text'), str) for part in parts):
        raise AIRequestError('Invalid response content')
    return ''.join(part['text'] for part in parts)


def request_batch(sources, api_key, api_endpoint, model, system_prompt, parse_response, *, reasoning_effort=None, deadline=None):
    endpoint = api_endpoint.rstrip('/')
    use_responses = endpoint.endswith('/responses') or (model.startswith('gpt-6') and reasoning_effort not in (None, '', 'none'))
    for suffix in ('/chat/completions', '/responses'):
        if endpoint.endswith(suffix):
            endpoint = endpoint.removesuffix(suffix)
            break
    if use_responses:
        endpoint += '/responses'
        payload = {'model': model, 'instructions': system_prompt,
                   'input': json.dumps(sources, ensure_ascii=False),
                   'reasoning': {'effort': reasoning_effort or 'none'}, 'store': False}
    else:
        endpoint += '/chat/completions'
        payload = {'model': model, 'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': json.dumps(sources, ensure_ascii=False)},
        ], 'temperature': 0.1}
        if model.startswith('gpt-6'):
            payload.pop('temperature', None)
            payload['reasoning_effort'] = 'none'
        if reasoning_effort:
            payload.pop('temperature', None)
            payload['reasoning_effort'] = reasoning_effort
    last_error = 'AI request failed'
    for attempt in range(3):
        remaining = deadline - time.monotonic() if deadline is not None else 90
        if remaining <= 0:
            raise AIRequestError('Translation time budget exhausted')
        delay = 2 ** attempt
        try:
            response = _session().post(endpoint, headers={'Authorization': f'Bearer {api_key}'}, json=payload, timeout=(min(10, remaining), min(90, remaining)))
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
                    body = response.json()
                    if use_responses:
                        content = _response_text(body, model, reasoning_effort or 'none')
                    else:
                        content = body['choices'][0]['message']['content']
                    return parse_response(content, sources)
                except (ValueError, KeyError, IndexError, TypeError, AIRequestError):
                    last_error = 'Invalid AI response'
        except requests.RequestException as error:
            last_error = f'AI network error: {type(error).__name__}'
        if attempt < 2:
            if deadline is not None:
                delay = min(delay, max(0, deadline - time.monotonic()))
            time.sleep(delay)
    raise AIRequestError(last_error)
