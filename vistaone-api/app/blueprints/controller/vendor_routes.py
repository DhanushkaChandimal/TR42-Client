from flask import Blueprint, request, jsonify
from app.blueprints.services.vendor_service import VendorService
from app.blueprints.repository.client_vendor_repository import ClientVendorRepository
from app.models.client_vendor import ClientVendor
from app.utils.util import permission_required, get_current_user_client_id
import logging

logger = logging.getLogger(__name__)

vendor_bp = Blueprint("vendor", __name__)


@vendor_bp.route("/", methods=["GET"])
@permission_required("vendors", "read")
def list_vendors(user_id):
    status = request.args.get("status")
    compliance = request.args.get("compliance")
    result, code = VendorService.get_all_vendors(
        status=status, compliance=compliance
    )
    return jsonify(result), code


@vendor_bp.route("/search", methods=["GET"])
@permission_required("vendors", "read")
def search_vendors(user_id):
    """Paginated marketplace search. Returns
    {items, total, page, per_page, has_more}."""
    args = request.args
    try:
        page = int(args.get("page", 1))
        per_page = int(args.get("per_page", 30))
    except ValueError:
        return jsonify({"error": "page and per_page must be integers"}), 400

    # scope=engaged restricts the marketplace to vendors the caller's client
    # has any relationship with (favourited, or named on a WO/ticket/invoice).
    engaged_client = None
    if (args.get("scope") or "").lower() == "engaged":
        engaged_client = get_current_user_client_id()
        if not engaged_client:
            return jsonify({"error": "Caller has no client"}), 400

    result, code = VendorService.search_vendors(
        q=args.get("q") or None,
        service_id=args.get("service_id") or None,
        status=args.get("status") or None,
        compliance=args.get("compliance") or None,
        engaged_with_client_id=engaged_client,
        sort_by=args.get("sort_by") or "company_name",
        order=args.get("order") or "asc",
        page=page,
        per_page=per_page,
    )
    return jsonify(result), code


@vendor_bp.route("/services", methods=["GET"])
@permission_required("vendors", "read")
def list_vendor_services(user_id):
    """Distinct services available across vendors, for filter dropdowns."""
    result, code = VendorService.list_distinct_services()
    return jsonify(result), code


@vendor_bp.route("/<vendor_id>", methods=["GET"])
@permission_required("vendors", "read")
def get_vendor(user_id, vendor_id):
    result, code = VendorService.get_vendor_by_id(vendor_id)
    return jsonify(result), code


@vendor_bp.route("/", methods=["POST"])
@permission_required("vendors", "write")
def create_vendor(user_id):
    body = request.get_json() or {}
    result, code = VendorService.create_vendor(body, user_id)
    return jsonify(result), code


@vendor_bp.route("/<vendor_id>", methods=["PATCH"])
@permission_required("vendors", "write")
def update_vendor(user_id, vendor_id):
    body = request.get_json() or {}
    result, code = VendorService.update_vendor(vendor_id, body, user_id)
    return jsonify(result), code


@vendor_bp.route("/favorites/<client_id>", methods=["GET"])
@permission_required("vendors", "read")
def get_favorites(user_id, client_id):
    # Caller may only list favorites for their own client.
    caller_client_id = get_current_user_client_id()
    if not caller_client_id or caller_client_id != client_id:
        return jsonify({"error": "Forbidden"}), 403
    try:
        links = ClientVendorRepository.get_by_client(client_id)
        result, code = VendorService.get_all_vendors()
        all_vendors = result
        favorite_ids = {link.vendor_id for link in links}
        favorites = [v for v in all_vendors if v["id"] in favorite_ids]
        return jsonify(favorites), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@vendor_bp.route("/favorites", methods=["POST"])
@permission_required("vendors", "write")
def add_favorite(user_id):
    body = request.get_json() or {}
    client_id = body.get("client_id")
    vendor_id = body.get("vendor_id")
    if not client_id or not vendor_id:
        return jsonify({"error": "client_id and vendor_id are required"}), 400
    caller_client_id = get_current_user_client_id()
    if not caller_client_id or caller_client_id != client_id:
        return jsonify({"error": "Forbidden"}), 403
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


@vendor_bp.route("/favorites/<client_id>/<vendor_id>", methods=["DELETE"])
@permission_required("vendors", "delete")
def remove_favorite(user_id, client_id, vendor_id):
    caller_client_id = get_current_user_client_id()
    if not caller_client_id or caller_client_id != client_id:
        return jsonify({"error": "Forbidden"}), 403
    link = ClientVendorRepository.get_by_client_and_vendor(client_id, vendor_id)
    if not link:
        return jsonify({"error": "Vendor not in favorites"}), 404
    try:
        ClientVendorRepository.delete(link)
        return jsonify({"message": "Vendor removed from favorites"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400
