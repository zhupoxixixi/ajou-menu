import os
import unittest
from unittest.mock import Mock, patch
from scraper import healthcheck


class HealthcheckTests(unittest.TestCase):
    def test_default_never_contacts_an_external_service(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(healthcheck, 'urlopen') as request:
            healthcheck.report()
        request.assert_not_called()

    def test_failure_uses_fail_endpoint_and_secret_is_not_in_errors(self):
        settings = {'ENABLE_HEALTHCHECKS': 'true', 'HEALTHCHECK_PING_URL': 'https://example.invalid/private-token', 'MENU_JOB_STATUS': 'failure'}
        response = Mock()
        response.__enter__ = Mock(return_value=Mock(status=200))
        response.__exit__ = Mock(return_value=False)
        with patch.dict(os.environ, settings, clear=True), patch.object(healthcheck, 'urlopen', return_value=response) as request:
            healthcheck.report()
        self.assertEqual(request.call_args.args[0].full_url, 'https://example.invalid/private-token/fail')
        with patch.dict(os.environ, settings, clear=True), patch.object(healthcheck, 'urlopen', side_effect=OSError('secret URL here')):
            with self.assertRaisesRegex(RuntimeError, '^External healthcheck request failed.$'):
                healthcheck.report()
