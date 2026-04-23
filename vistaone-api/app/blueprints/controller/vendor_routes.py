from flask import Blueprint, request, jsonify
from app.blueprints.services.vendor_service import VendorService
from app.blueprints.repository.client_vendor_repository import ClientVendorRepository
from app.models.client_vendor import ClientVendor
from app.utils.util import token_required
import logging

logger = logging.getLogger(__name__)

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


# GET favorite vendors for a client
@vendor_bp.route("/favorites/<client_id>", methods=["GET"])
@token_required
def get_favorites(user_id, client_id):
    try:
        links = ClientVendorRepository.get_by_client(client_id)
        result, code = VendorService.get_all_vendors()
        all_vendors = result
        favorite_ids = {link.vendor_id for link in links}
        favorites = [v for v in all_vendors if v["id"] in favorite_ids]
        return jsonify(favorites), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ADD vendor to client favorites
@vendor_bp.route("/favorites", methods=["POST"])
@token_required
def add_favorite(user_id):
    body = request.get_json() or {}
    client_id = body.get("client_id")
    vendor_id = body.get("vendor_id")
    if not client_id or not vendor_id:
        return jsonify({"error": "client_id and vendor_id are required"}), 400
    existing = ClientVendorRepository.get_by_client_and_vendor(client_id, vendor_id)
    if existing:
        return jsonify({"message": "Vendor already in favorites"}), 200
    try:
        link = ClientVendor(
            client_id=client_id,
            vendor_id=vendor_id,
            created_by=str(user_id),
        )
        ClientVendorRepository.create(link)
        return jsonify({"message": "Vendor added to favorites"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# REMOVE vendor from client favorites
@vendor_bp.route("/favorites/<client_id>/<vendor_id>", methods=["DELETE"])
@token_required
def remove_favorite(user_id, client_id, vendor_id):
    link = ClientVendorRepository.get_by_client_and_vendor(client_id, vendor_id)
    if not link:
        return jsonify({"error": "Vendor not in favorites"}), 404
    try:
        ClientVendorRepository.delete(link)
        return jsonify({"message": "Vendor removed from favorites"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400
