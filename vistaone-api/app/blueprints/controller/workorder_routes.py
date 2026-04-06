from flask import request, jsonify
from . import workorder_bp
from app.models import WorkOrder,db
from app.blueprints.schema.workorderSchemas import workorder_schema, workorders_schema
from app.blueprints.services.workorder_service import create_workorder
import uuid
from sqlalchemy import select
from marshmallow import ValidationError


# -----------------------------
# CREATE WorkOrder
# -----------------------------
@workorder_bp.route("/", methods=["POST"])
def create():
    """
    POST /workorders
    Create a new work order with validation.
    """
    json_data = request.get_json()
    if not json_data:
        return jsonify({"error": "No input data provided"}), 400

    # Validate schema
    try:
        validated_data = workorder_schema.load(json_data)
    except Exception as err:
        return jsonify({"error": str(err)}), 400

    created_workorder = create_workorder(validated_data)

    return workorder_schema.jsonify(created_workorder), 201