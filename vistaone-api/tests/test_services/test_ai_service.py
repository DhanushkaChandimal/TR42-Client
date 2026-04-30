"""Unit tests for AI MSA analyst service helpers.

Pure unit tests with no Ollama or DB required: HTTP calls and file I/O are mocked.
"""
import json
import unittest
from unittest.mock import MagicMock, patch

from app.blueprints.services.ai_service import (
    OllamaClient,
    OllamaError,
    pages_to_prompt_text,
    validate_analysis,
)


def _valid_payload():
    return {
        "executive_summary": "An MSA between Client Co and Vendor Inc covering field services.",
        "key_terms": [
            {"rule_type": "term_length", "description": "1 year initial term", "value": "1y"}
        ],
        "risks": [
            {"rule_type": "liability_cap", "description": "Capped at fees paid in last 12 months"}
        ],
        "red_flags": [
            {"rule_type": "missing", "description": "No insurance clause present"}
        ],
        "action_items": [
            {"rule_type": "confirm", "description": "Verify governing law"}
        ],
        "service_rates": [
            {
                "service_label": "Hot Shot Trucking",
                "value": "150.00",
                "unit": "per_hour",
            }
        ],
        "disclaimer": "This summary is for informational purposes only and does not constitute legal advice.",
    }


class TestPagesToPromptText(unittest.TestCase):
    def test_basic_join(self):
        pages = [{"page": 1, "text": "alpha"}, {"page": 2, "text": "beta"}]
        out = pages_to_prompt_text(pages)
        self.assertIn("[PAGE 1]", out)
        self.assertIn("alpha", out)
        self.assertIn("[PAGE 2]", out)
        self.assertIn("beta", out)

    def test_truncates_to_max_chars(self):
        pages = [{"page": 1, "text": "x" * 1000}]
        out = pages_to_prompt_text(pages, max_chars=50)
        self.assertEqual(len(out), 50)


class TestValidateAnalysis(unittest.TestCase):
    def test_accepts_valid_payload(self):
        self.assertEqual(validate_analysis(_valid_payload()), _valid_payload())

    def test_rejects_missing_section(self):
        bad = _valid_payload()
        del bad["service_rates"]
        with self.assertRaises(ValueError):
            validate_analysis(bad)

    def test_rejects_rate_missing_required_fields(self):
        bad = _valid_payload()
        bad["service_rates"] = [{"unit": "per_hour"}]
        with self.assertRaises(ValueError):
            validate_analysis(bad)

    def test_rejects_wrong_type(self):
        bad = _valid_payload()
        bad["executive_summary"] = 123
        with self.assertRaises(ValueError):
            validate_analysis(bad)


class TestOllamaClient(unittest.TestCase):
    @patch("app.blueprints.services.ai_service.requests.post")
    def test_chat_json_returns_parsed_dict(self, mock_post):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=MagicMock(
                return_value={"message": {"content": json.dumps(_valid_payload())}}
            ),
        )
        client = OllamaClient(
            base_url="http://localhost:11434", model="llama3.1:8b", timeout_s=10
        )
        out = client.chat_json("system", "user")
        self.assertIn("executive_summary", out)
        self.assertEqual(out["service_rates"][0]["service_label"], "Hot Shot Trucking")

    @patch("app.blueprints.services.ai_service.requests.post")
    def test_chat_json_raises_on_non_200(self, mock_post):
        mock_post.return_value = MagicMock(status_code=500, text="internal error")
        client = OllamaClient(
            base_url="http://localhost:11434", model="llama3.1:8b", timeout_s=10
        )
        with self.assertRaises(OllamaError):
            client.chat_json("system", "user")

    @patch("app.blueprints.services.ai_service.requests.post")
    def test_chat_json_raises_on_invalid_json(self, mock_post):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={"message": {"content": "not valid json"}}),
        )
        client = OllamaClient(
            base_url="http://localhost:11434", model="llama3.1:8b", timeout_s=10
        )
        with self.assertRaises(OllamaError):
            client.chat_json("system", "user")

    @patch("app.blueprints.services.ai_service.requests.post")
    def test_chat_json_raises_on_empty_content(self, mock_post):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={"message": {"content": ""}}),
        )
        client = OllamaClient(
            base_url="http://localhost:11434", model="llama3.1:8b", timeout_s=10
        )
        with self.assertRaises(OllamaError):
            client.chat_json("system", "user")

    def test_strips_trailing_slash_from_base_url(self):
        client = OllamaClient(
            base_url="http://localhost:11434/", model="m", timeout_s=10
        )
        self.assertEqual(client.base_url, "http://localhost:11434")

    @patch("app.blueprints.services.ai_service.requests.post")
    def test_chat_json_passes_schema_when_provided(self, mock_post):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={"message": {"content": "{}"}}),
        )
        client = OllamaClient(
            base_url="http://localhost:11434", model="m", timeout_s=10
        )
        schema = {"type": "object"}
        client.chat_json("system", "user", schema=schema)
        sent = mock_post.call_args.kwargs["json"]
        self.assertEqual(sent["format"], schema)

    @patch("app.blueprints.services.ai_service.requests.post")
    def test_chat_json_defaults_to_json_string_format(self, mock_post):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={"message": {"content": "{}"}}),
        )
        client = OllamaClient(
            base_url="http://localhost:11434", model="m", timeout_s=10
        )
        client.chat_json("system", "user")
        sent = mock_post.call_args.kwargs["json"]
        self.assertEqual(sent["format"], "json")


if __name__ == "__main__":
    unittest.main()
