"""Unit tests for AI MSA analyst service helpers.

Pure unit tests with no Ollama or DB required: HTTP calls and file I/O are mocked.
"""
import json
import unittest
from unittest.mock import MagicMock, patch

from app.blueprints.services.ai_service import (
    AiService,
    OllamaClient,
    OllamaError,
    pages_to_prompt_text,
    validate_analysis,
)


def _valid_payload():
    return {
        "executive_summary": {
            "summary": "An MSA between Client Co and Vendor Inc covering field services.",
            "parties": [
                {"role": "Company", "name": "Client Co"},
                {"role": "Contractor", "name": "Vendor Inc"},
            ],
            "effective_date": "2024-01-15",
            "term_length": "1 year",
            "term_end_or_renewal": "Auto-renews annually unless 30 days notice",
        },
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
                "extracted_text": "Hot Shot Trucking shall be billed at $150.00 per hour.",
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


class TestFilterHallucinatedRates(unittest.TestCase):
    def test_keeps_rate_quoted_from_source(self):
        source = (
            "Section 5. Rates. Hot Shot Trucking shall be billed at $150.00 "
            "per hour for all dispatched runs."
        )
        payload = {
            "service_rates": [
                {
                    "service_label": "Hot Shot Trucking",
                    "value": "150.00",
                    "extracted_text": "Hot Shot Trucking shall be billed at $150.00 per hour",
                }
            ]
        }
        out = AiService._filter_hallucinated_rates(payload, source)
        self.assertEqual(len(out["service_rates"]), 1)

    def test_drops_rate_not_in_source(self):
        source = "This agreement contains no service rates whatsoever."
        payload = {
            "service_rates": [
                {
                    "service_label": "Wireline survey",
                    "value": "5",
                    "extracted_text": "Wireline survey at $5 per foot",
                }
            ]
        }
        out = AiService._filter_hallucinated_rates(payload, source)
        self.assertEqual(out["service_rates"], [])

    def test_drops_rate_with_empty_extracted_text(self):
        source = "Some contract text."
        payload = {
            "service_rates": [
                {"service_label": "X", "value": "1", "extracted_text": ""}
            ]
        }
        out = AiService._filter_hallucinated_rates(payload, source)
        self.assertEqual(out["service_rates"], [])

    def test_normalizes_whitespace_and_case(self):
        source = "We will provide MUD LOGGING at $1,250 per day on site."
        payload = {
            "service_rates": [
                {
                    "service_label": "Mud logging",
                    "value": "1250",
                    "extracted_text": "we will provide   mud logging at $1,250 per day",
                }
            ]
        }
        out = AiService._filter_hallucinated_rates(payload, source)
        self.assertEqual(len(out["service_rates"]), 1)

    def test_drops_when_value_not_in_source(self):
        # The extracted_text is genuinely in the source (section 1 prose), but
        # the rate amount is fabricated. This is the real-world failure where
        # the model paraphrased a real services list and made up a price.
        source = (
            "Contractor shall provide industrial pump maintenance, "
            "flow measurement, and control system integration."
        )
        payload = {
            "service_rates": [
                {
                    "service_label": "industrial pump maintenance",
                    "value": "15000",
                    "extracted_text": (
                        "Contractor shall provide industrial pump maintenance"
                    ),
                }
            ]
        }
        out = AiService._filter_hallucinated_rates(payload, source)
        self.assertEqual(out["service_rates"], [])


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
