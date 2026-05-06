from flask import request, jsonify, Blueprint
from app.blueprints.schema.workorder_schema import workorder_schema, workorders_schema
from app.blueprints.services.workorder_service import WorkOrderService
from app.blueprints.schema.cancel_workorder_schema import cancel_workorder_schema
from marshmallow import ValidationError
from app.utils.util import permission_required, get_current_user_client_id
import logging


logger = logging.getLogger(__name__)

workorder_bp = Blueprint("workorder_bp", __name__)


@workorder_bp.route("/", methods=["POST"])
@permission_required("workorders", "write")
def create_workorder(current_user_id):
    json_data = request.get_json()
    if not json_data:
        return jsonify({"error": "No input data provided"}), 400
    if not current_user_id:
        raise Exception("current_user_id not provided!")

    # Always source client_id from the JWT — never trust the caller.
    json_data["client_id"] = get_current_user_client_id()

    try:
        validated_workorder_data = workorder_schema.load(json_data)
        workorder = WorkOrderService.create_workorder(
            validated_workorder_data, current_user_id
        )
        return workorder_schema.jsonify(workorder), 201

    except ValidationError as err:
        return jsonify(err.messages), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@workorder_bp.route("/", methods=["GET"])
@permission_required("workorders", "read")
def get_all_workorders(current_user_id):
    client_id = get_current_user_client_id()
    workorders = WorkOrderService.get_all_workorders(client_id=client_id)
    return workorders_schema.jsonify(workorders), 200


@workorder_bp.route("/<string:work_order_id>", methods=["GET"])
@permission_required("workorders", "read")
def get_workorder(current_user_id, work_order_id):
    try:
        client_id = get_current_user_client_id()
        workorder = WorkOrderService.get_workorder(work_order_id, current_user_id, client_id=client_id)
        if not workorder:
            return jsonify({"error": "WorkOrder not found"}), 404

        return workorder_schema.jsonify(workorder), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400


@workorder_bp.route("/<string:work_order_id>", methods=["PUT"])
@permission_required("workorders", "write")
def update_workorder(current_user_id, work_order_id):
    json_data = request.get_json()
    if not json_data:
        return jsonify({"error": "No input data provided"}), 400
    try:
        client_id = get_current_user_client_id()
        validated_data = workorder_schema.load(json_data, partial=True)
        workorder = WorkOrderService.update_workorder(
            current_user_id, work_order_id, validated_data, client_id=client_id
        )
        return workorder_schema.jsonify(workorder), 200
    except ValidationError as err:
        return jsonify(err.messages), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@workorder_bp.route("/<string:work_order_id>", methods=["DELETE"])
@permission_required("workorders", "delete")
def delete_workorder(current_user_id, work_order_id):
    if not current_user_id:
        raise Exception("current_user_id not provided!")

    json_data = request.get_json()

    if not json_data or not json_data.get("cancellation_reason"):
        return jsonify({"error": "Cancellation reason is required"}), 400
    try:
        client_id = get_current_user_client_id()
        validate_data = cancel_workorder_schema.load(json_data)
        WorkOrderService.cancel_workorder(
            work_order_id=work_order_id,
            cancellation_reason=validate_data["cancellation_reason"],
            current_user_id=current_user_id,
            client_id=client_id,
        )

        return jsonify({"message": "Cancelled successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@workorder_bp.route("/search", methods=["GET"])
@permission_required("workorders", "read")
def search_workorders(current_user_id):
    if not current_user_id:
        raise Exception("current_user_id not provided!")
    try:
        search_text = request.args.get("q", "")
        # Empty/missing status means "all" — defaulting to UNASSIGNED hid every other state.
        status = request.args.get("status") or None
        if status == "ALL":
            status = None

        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 10))

        sort_by = request.args.get("sort_by", "created_at")
        order = request.args.get("order", "desc")

        client_id = get_current_user_client_id()
        result = WorkOrderService.search_workorders(
            search_text, status, page, per_page, sort_by, order, client_id=client_id
        )

        return (
            jsonify(
                {
                    "total": result.total,
                    "count": len(result.items),
                    "page": result.page,
                    "pages": result.pages,
                    "data": workorders_schema.dump(result.items),
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 400
