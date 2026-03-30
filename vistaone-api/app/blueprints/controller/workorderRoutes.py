from flask import request, jsonify
from . import workorder_bp
from app.models import WorkOrder,db
from .schemas import workorder_schema, workorders_schema
import uuid
from sqlalchemy import select
from marshmallow import ValidationError


# CREATE WORK ORDER
@workorder_bp.route("/", methods=["POST"])
def create_workorder():

    try:
        data = workorder_schema.load(request.json)
    except ValidationError as e:
        return jsonify(e.messages), 400

    new_workorder = WorkOrder(**data)
    new_workorder.created_at = db.func.now()
    new_workorder.created_by = 'Admin'

    db.session.add(new_workorder)
    db.session.commit()

    return jsonify({
        "message": "Work order created successfully",
        "data": workorder_schema.dump(new_workorder)
    }), 201


# GET ALL WORK ORDERS
@workorder_bp.route("/", methods=["GET"])
def get_workorders():

    query = select(WorkOrder)

    result = db.session.execute(query).scalars().all()

    return jsonify(workorders_schema.dump(result)), 200


# GET SINGLE WORK ORDER
@workorder_bp.route("/<work_order_id>", methods=["GET"])
def get_workorder(work_order_id):

    query = select(WorkOrder).where(WorkOrder.work_order_id == work_order_id)

    workorder = db.session.execute(query).scalars().first()

    if not workorder:
        return jsonify({"message": "Work order not found"}), 404

    return jsonify(workorder_schema.dump(workorder)), 200


'''

# CREATE WORK ORDER

@workorder_bp.route("/", methods=["POST"])
def create_workorder():
    #data = request.get_json()

    try:
        data = workorder_schema.load(request.json)
    except ValidationError as e:
        return jsonify(e.messages), 400
    
    #validated_data = workorder_schema.load(data)

    new_workorder = WorkOrder(
        work_order_id=str(uuid.uuid4()),
        description=validated_data["description"],
        due_date=validated_data.get("due_date"),
        current_status=validated_data["current_status"],
        comments=validated_data.get("comments"),
        location=validated_data.get("location"),
        estimated_cost=validated_data.get("estimated_cost"),
        priority=validated_data["priority"],
        well_id=validated_data.get("well_id"),
        created_by=validated_data["created_by"],
        updated_by=validated_data["updated_by"]
    )


    new_workorder = WorkOrder(**data)

    db.session.add(new_workorder)
    db.session.commit()

    return jsonify({"message": "Work order created successfully"}), 201
'''