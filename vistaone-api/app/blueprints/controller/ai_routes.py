import os

from flask import Blueprint, jsonify, request
from app.blueprints.services.ai_service import (
    AiService,
    TextExtractionError,
    extract_tables,
    extract_text,
)
from app.utils.util import permission_required
import logging

logger = logging.getLogger(__name__)

ai_bp = Blueprint("ai", __name__)


def _scope_or_error(user_id, msa_id):
    """Resolve the MSA and tenant-check the caller. Returns (msa, error_response).

    error_response is None on success, otherwise a (json, status) tuple the
    route handler should return directly.
    """
    msa, ok = AiService.can_user_access_msa(user_id, msa_id)
    if not msa:
        return None, (jsonify({"message": "MSA not found"}), 404)
    if not ok:
        return None, (jsonify({"message": "You do not have access to this MSA"}), 403)
    return msa, None


@ai_bp.route("/msa/<msa_id>/analyze", methods=["POST"])
@permission_required("contracts", "write")
def analyze(user_id, msa_id):
    _, err = _scope_or_error(user_id, msa_id)
    if err:
        return err
    result, code = AiService.analyze_msa(msa_id, user_id)
    return jsonify(result), code


@ai_bp.route("/msa/<msa_id>/analysis", methods=["GET"])
@permission_required("contracts", "read")
def get_analysis(user_id, msa_id):
    _, err = _scope_or_error(user_id, msa_id)
    if err:
        return err
    result, code = AiService.get_analysis(msa_id)
    return jsonify(result), code


@ai_bp.route("/msa/<msa_id>/pricing", methods=["GET"])
@permission_required("contracts", "read")
def get_pricing(user_id, msa_id):
    _, err = _scope_or_error(user_id, msa_id)
    if err:
        return err
    result, code = AiService.get_pricing(msa_id)
    return jsonify(result), code


@ai_bp.route("/msa/<msa_id>/notes", methods=["GET"])
@permission_required("contracts", "read")
def list_notes(user_id, msa_id):
    """Per-MSA team notes, shared across the client's users."""
    _, err = _scope_or_error(user_id, msa_id)
    if err:
        return err
    notes, code = AiService.get_notes(msa_id)
    return jsonify({"notes": notes}), code


@ai_bp.route("/msa/<msa_id>/notes", methods=["POST"])
@permission_required("contracts", "write")
def add_note(user_id, msa_id):
    _, err = _scope_or_error(user_id, msa_id)
    if err:
        return err
    payload = request.get_json(silent=True) or {}
    note, code = AiService.add_note(msa_id, payload.get("body"), user_id)
    return jsonify(note), code


@ai_bp.route("/msa/<msa_id>/text", methods=["GET"])
@permission_required("contracts", "read")
def get_text(user_id, msa_id):
    """Return extracted text for the MSA file, page-by-page.

    Used by the analysis modal to render Word documents in the browser since
    iframes cannot natively display .doc/.docx. PDFs use the existing
    /api/msa/<id>/download endpoint for native browser preview instead.
    """
    msa, err = _scope_or_error(user_id, msa_id)
    if err:
        return err
    if not msa.file_name:
        return jsonify({"pages": []}), 200

    from app.blueprints.services.msa_service import UPLOAD_DIR

    path = os.path.join(UPLOAD_DIR, msa.file_name)
    if not os.path.exists(path):
        return jsonify({"message": f"File missing on disk: {msa.file_name}"}), 404

    try:
        pages = extract_text(path)
        tables = extract_tables(path)
    except TextExtractionError as e:
        return jsonify({"message": str(e)}), 422

    return (
        jsonify(
            {
                "pages": pages,
                "tables": tables,
                "file_name": msa.file_name,
            }
        ),
        200,
    )
