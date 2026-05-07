from flask import Blueprint, request, jsonify, send_from_directory
from app.blueprints.services.msa_service import MsaService, UPLOAD_DIR
from app.utils.util import permission_required, get_current_user_client_id
import logging

logger = logging.getLogger(__name__)

msa_bp = Blueprint("msa", __name__)


@msa_bp.route("/", methods=["GET"])
@permission_required("contracts", "read")
def list_msas(user_id):
    client_id = get_current_user_client_id()
    vendor_id = request.args.get("vendor_id")
    status = request.args.get("status")
    result, code = MsaService.get_all(vendor_id=vendor_id, status=status, client_id=client_id)
    return jsonify(result), code


@msa_bp.route("/<msa_id>", methods=["GET"])
@permission_required("contracts", "read")
def get_msa(user_id, msa_id):
    client_id = get_current_user_client_id()
    result, code = MsaService.get_by_id(msa_id, client_id=client_id)
    return jsonify(result), code


@msa_bp.route("/", methods=["POST"])
@permission_required("contracts", "write")
def upload_msa(user_id):
    file = request.files.get("file")
    result, code = MsaService.upload_msa(request.form, file, user_id)
    return jsonify(result), code


@msa_bp.route("/<msa_id>", methods=["PATCH"])
@permission_required("contracts", "write")
def update_msa(user_id, msa_id):
    client_id = get_current_user_client_id()
    body = request.get_json() or {}
    result, code = MsaService.update_msa(msa_id, body, user_id, client_id=client_id)
    return jsonify(result), code


@msa_bp.route("/<msa_id>/download", methods=["GET"])
@permission_required("contracts", "read")
def download_msa(user_id, msa_id):
    from app.blueprints.services import storage_service

    client_id = get_current_user_client_id()
    result, code = MsaService.get_by_id(msa_id, client_id=client_id)
    if code != 200:
        return jsonify(result), code
    if not result.get("file_name"):
        return jsonify({"message": "No file attached to this MSA"}), 404
    # Ensure the file is materialized locally (downloads from the
    # bucket on first request from this backend instance).
    try:
        local_path = storage_service.ensure_local(result["file_name"])
    except FileNotFoundError as e:
        return jsonify({"message": str(e)}), 404
    return send_from_directory(local_path.parent, local_path.name)
