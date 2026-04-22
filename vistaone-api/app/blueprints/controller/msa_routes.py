from flask import Blueprint, request, jsonify, send_from_directory
from app.blueprints.services.msa_service import MsaService, UPLOAD_DIR
from app.utils.util import token_required
import logging

logger = logging.getLogger(__name__)

msa_bp = Blueprint("msa", __name__)


@msa_bp.route("/", methods=["GET"])
@token_required
def list_msas(user_id):
    vendor_id = request.args.get("vendor_id")
    status = request.args.get("status")
    result, code = MsaService.get_all(vendor_id=vendor_id, status=status)
    return jsonify(result), code


@msa_bp.route("/<msa_id>", methods=["GET"])
@token_required
def get_msa(user_id, msa_id):
    result, code = MsaService.get_by_id(msa_id)
    return jsonify(result), code


@msa_bp.route("/", methods=["POST"])
@token_required
def upload_msa(user_id):
    file = request.files.get("file")
    result, code = MsaService.upload_msa(request.form, file, user_id)
    return jsonify(result), code


@msa_bp.route("/<msa_id>", methods=["PATCH"])
@token_required
def update_msa(user_id, msa_id):
    body = request.get_json() or {}
    result, code = MsaService.update_msa(msa_id, body, user_id)
    return jsonify(result), code


@msa_bp.route("/<msa_id>/download", methods=["GET"])
@token_required
def download_msa(user_id, msa_id):
    result, code = MsaService.get_by_id(msa_id)
    if code != 200:
        return jsonify(result), code
    if not result.get("file_name"):
        return jsonify({"message": "No file attached to this MSA"}), 404
    return send_from_directory(UPLOAD_DIR, result["file_name"])
