from flask import Blueprint, request, jsonify
from app.blueprints.services.vendor_service import VendorService
from app.utils.util import token_required

vendor_bp = Blueprint("vendor", __name__)


@vendor_bp.route("/", methods=["GET"])
@token_required
def list_vendors(user_id):
    status = request.args.get("status")
    compliance = request.args.get("compliance")
    result, code = VendorService.get_all_vendors(
        status=status, compliance=compliance
    )
    return jsonify(result), code


@vendor_bp.route("/<vendor_id>", methods=["GET"])
@token_required
def get_vendor(user_id, vendor_id):
    result, code = VendorService.get_vendor_by_id(vendor_id)
    return jsonify(result), code


@vendor_bp.route("/", methods=["POST"])
@token_required
def create_vendor(user_id):
    body = request.get_json() or {}
    result, code = VendorService.create_vendor(body, user_id)
    return jsonify(result), code


@vendor_bp.route("/<vendor_id>", methods=["PATCH"])
@token_required
def update_vendor(user_id, vendor_id):
    body = request.get_json() or {}
    result, code = VendorService.update_vendor(vendor_id, body, user_id)
    return jsonify(result), code
