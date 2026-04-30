"""AI MSA analyst service helpers.

Local-only LLM by default (Ollama). Provider seam in place so a hosted free tier
(e.g. Groq, HF) can be added later without changing call sites.

This module is helper-only:
- text extraction from PDF / DOCX
- HTTP client for Ollama /api/chat with format=json
- JSON-schema validation for the analyst response

Persistence (mapping the validated payload to msa_requirement rows) lands in
the next change set alongside the routes.
"""
import json
import logging
import os
from pathlib import Path

import requests
from docx import Document
from jsonschema import ValidationError, validate as jsonschema_validate
from pypdf import PdfReader

logger = logging.getLogger(__name__)


# JSON shape the model must return. Mirrors the analyst prompt sections plus
# service_rates for pricing extraction. Keys map to msa_requirement.category.
ANALYSIS_JSON_SCHEMA = {
    "type": "object",
    "required": [
        "executive_summary",
        "key_terms",
        "risks",
        "red_flags",
        "action_items",
        "service_rates",
        "disclaimer",
    ],
    "properties": {
        "executive_summary": {"type": "string"},
        "key_terms": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["rule_type", "description"],
                "properties": {
                    "rule_type": {"type": "string"},
                    "description": {"type": "string"},
                    "value": {"type": ["string", "null"]},
                    "page_number": {"type": ["integer", "null"]},
                    "extracted_text": {"type": ["string", "null"]},
                    "confidence": {"type": ["number", "null"]},
                },
            },
        },
        "risks": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["rule_type", "description"],
                "properties": {
                    "rule_type": {"type": "string"},
                    "description": {"type": "string"},
                    "value": {"type": ["string", "null"]},
                    "page_number": {"type": ["integer", "null"]},
                    "extracted_text": {"type": ["string", "null"]},
                    "confidence": {"type": ["number", "null"]},
                },
            },
        },
        "red_flags": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["rule_type", "description"],
                "properties": {
                    "rule_type": {"type": "string"},
                    "description": {"type": "string"},
                    "page_number": {"type": ["integer", "null"]},
                    "extracted_text": {"type": ["string", "null"]},
                    "severity": {"type": ["string", "null"]},
                },
            },
        },
        "action_items": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["rule_type", "description"],
                "properties": {
                    "rule_type": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"type": ["string", "null"]},
                },
            },
        },
        "service_rates": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["service_label", "value"],
                "properties": {
                    "service_label": {"type": "string"},
                    "value": {"type": "string"},
                    "unit": {"type": ["string", "null"]},
                    "currency": {"type": ["string", "null"]},
                    "page_number": {"type": ["integer", "null"]},
                    "extracted_text": {"type": ["string", "null"]},
                    "notes": {"type": ["string", "null"]},
                },
            },
        },
        "disclaimer": {"type": "string"},
    },
}


SYSTEM_PROMPT = """You are an AI contract analyst specialized in reviewing Master Service Agreements (MSAs).
You will receive the full text of an MSA. Return a single JSON object that conforms exactly
to the provided schema. Do not include any text outside the JSON.

Sections to populate:

1. executive_summary: 3 to 5 plain-language sentences covering what the agreement covers,
   the parties, and the overall nature of the relationship.

2. key_terms: Items for parties, effective_date, term_length, renewal, termination_conditions,
   scope_of_services, payment_terms, governing_law, jurisdiction. Use rule_type to label each.

3. risks: Items for liability_cap, indemnification, confidentiality, data_protection,
   ip_ownership, licensing, warranties, disclaimers, insurance, non_compete, non_solicit,
   exclusivity. Use rule_type to label each. Include the verbatim clause in extracted_text
   and page_number when known.

4. red_flags: Anything one-sided, atypical, ambiguous, or missing where typically expected.
   rule_type one of: one_sided | ambiguous | missing.

5. action_items: Short list of items the reviewer should confirm, negotiate, or escalate
   to legal counsel. rule_type one of: confirm | negotiate | escalate.

6. service_rates: Each pricing entry tied to a service. service_label is the service as
   written in the MSA. value is the rate amount as a string (e.g. "150.00"). unit is one of
   per_hour | per_day | per_foot | flat | other. Include page_number and extracted_text
   for traceability.

7. disclaimer: The exact string "This summary is for informational purposes only and does not constitute legal advice."

Use page_number and extracted_text wherever possible to support traceability.
"""


class TextExtractionError(Exception):
    pass


class OllamaError(Exception):
    pass


def extract_text(file_path):
    """Extract text from a PDF or DOCX MSA into a list of {page, text} dicts.

    DOCX has no real page boundaries so we synthesize them by paragraph chunks
    so downstream code can still cite a page_number for traceability.
    """
    p = Path(file_path)
    if not p.exists():
        raise TextExtractionError(f"File not found: {file_path}")

    suffix = p.suffix.lower()
    if suffix == ".pdf":
        return _extract_pdf(p)
    if suffix in (".docx", ".doc"):
        return _extract_docx(p)
    raise TextExtractionError(f"Unsupported file type: {suffix}")


def _extract_pdf(path):
    reader = PdfReader(str(path))
    pages = []
    for idx, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        pages.append({"page": idx, "text": text})
    return pages


def _extract_docx(path):
    doc = Document(str(path))
    paragraphs = [para.text for para in doc.paragraphs if para.text and para.text.strip()]
    chunk_size = 30
    pages = []
    for i in range(0, len(paragraphs), chunk_size):
        pages.append(
            {
                "page": (i // chunk_size) + 1,
                "text": "\n".join(paragraphs[i : i + chunk_size]),
            }
        )
    return pages or [{"page": 1, "text": ""}]


def pages_to_prompt_text(pages, max_chars=None):
    """Flatten extracted pages into a single tagged string for the prompt."""
    parts = [f"[PAGE {entry['page']}]\n{entry['text']}" for entry in pages]
    text = "\n\n".join(parts)
    if max_chars and len(text) > max_chars:
        text = text[:max_chars]
    return text


class OllamaClient:
    """Thin HTTP client for a local Ollama instance."""

    def __init__(self, base_url=None, model=None, timeout_s=None):
        self.base_url = (
            base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        ).rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.1:8b")
        self.timeout_s = int(timeout_s or os.getenv("OLLAMA_TIMEOUT_S", "180"))

    def chat_json(self, system_prompt, user_prompt, schema=None):
        """Call /api/chat and return the parsed JSON dict.

        When a schema is provided, Ollama constrains the model's output to match
        it (structured outputs, supported in Ollama 0.5+). Without a schema,
        falls back to plain JSON mode where the model decides the shape.
        """
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "format": schema if schema else "json",
            "options": {"temperature": 0.1},
        }
        try:
            resp = requests.post(url, json=payload, timeout=self.timeout_s)
        except requests.RequestException as e:
            logger.error(f"Ollama request failed: {e}")
            raise OllamaError(f"Ollama request failed: {e}") from e

        if resp.status_code != 200:
            raise OllamaError(
                f"Ollama returned {resp.status_code}: {resp.text[:500]}"
            )

        body = resp.json()
        content = body.get("message", {}).get("content", "")
        if not content:
            raise OllamaError("Ollama response had empty content")

        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            raise OllamaError(
                f"Ollama content was not valid JSON: {e}: {content[:500]}"
            ) from e


def validate_analysis(payload):
    """Validate a parsed analysis payload against ANALYSIS_JSON_SCHEMA.

    Returns the payload on success, raises ValueError on schema mismatch.
    """
    try:
        jsonschema_validate(payload, ANALYSIS_JSON_SCHEMA)
    except ValidationError as e:
        raise ValueError(f"AI response failed schema validation: {e.message}") from e
    return payload
