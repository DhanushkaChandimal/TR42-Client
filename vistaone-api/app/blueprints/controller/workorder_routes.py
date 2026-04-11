from flask import request, jsonify,Blueprint
from app.blueprints.schema.workorder_schema import workorder_schema, workorders_schema
from app.blueprints.services.workorder_service import WorkOrderService
from app.blueprints.schema.delete_workorder import delete_workorder_schema
from marshmallow import ValidationError
from app.utils.util import token_required


workorder_bp = Blueprint("workorder_bp", __name__)


# CREATE WorkOrder with token
@workorder_bp.route("/", methods=["POST"])
@token_required
def create_workorder(current_user_id):
    # Now we have access to current_user_id from the token, we can use it to set created_by field in the service layer.
    json_data = request.get_json()
    if not json_data:
        return jsonify({"error": "No input data provided"}), 400
    if not current_user_id:
                raise Exception("current_user_id not provided!")

    try:
        validated_workorder_data = workorder_schema.load(json_data)
        workorder = WorkOrderService.create_workorder(validated_workorder_data, current_user_id)
        return workorder_schema.jsonify(workorder), 201
    
    except ValidationError as err:
        return jsonify(err.messages), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# GET all
@workorder_bp.route("/", methods=["GET"])
@token_required
def get_all_workorders(current_user_id):
    workorders = WorkOrderService.get_all_workorders()
    return workorders_schema.jsonify(workorders), 200

# GET by ID
@workorder_bp.route("/<string:work_order_id>", methods=["GET"])
@token_required
def get_workorder(current_user_id,work_order_id):
    try:
        workorder = WorkOrderService.get_workorder(work_order_id, current_user_id)
        if not workorder:
            return jsonify({"error": "WorkOrder not found"}), 404
        
        return workorder_schema.jsonify(workorder), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# UPDATE
@workorder_bp.route("/<string:work_order_id>", methods=["PUT"])
@token_required
def update_workorder(current_user_id, work_order_id):
    json_data = request.get_json()
    if not json_data:
        return jsonify({"error": "No input data provided"}), 400
    try:
        validated_data = workorder_schema.load(json_data, partial=True)
        workorder = WorkOrderService.update_workorder(current_user_id,work_order_id, validated_data)
        return workorder_schema.jsonify(workorder), 200
    except ValidationError as err:
        return jsonify(err.messages), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# DELETE
@workorder_bp.route("/", methods=["DELETE"])
@token_required
def delete_workorder(current_user_id):
    if not current_user_id:
        raise Exception("current_user_id not provided!")
    
    json_data = request.get_json()
    
    if not json_data.get("work_order_id") or not json_data.get("cancellation_reason"):
        return jsonify({"error": "WorkOrder ID and cancellation reason are required"}), 400
    try:
        validate_delete_workorder = delete_workorder_schema.load(json_data)
        WorkOrderService.cancel_workorder(validate_delete_workorder, current_user_id)
        return jsonify({"message": "Deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    
