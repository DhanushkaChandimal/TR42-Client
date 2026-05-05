from flask import Blueprint, request, jsonify
from app.blueprints.services.well_service import WellService
from app.blueprints.schema.well_schema import well_schema, wells_schema
from app.utils.util import permission_required, get_current_user_client_id

well_bp = Blueprint("well_bp", __name__)


@well_bp.route("/", methods=["GET"])
@permission_required("wells", "read")
def get_wells(current_user_id):
    client_id = get_current_user_client_id()
    wells = WellService.get_all_wells(client_id=client_id)
    return wells_schema.jsonify(wells), 200


@well_bp.route("/<well_id>", methods=["GET"])
@permission_required("wells", "read")
def get_well(current_user_id, well_id):
    try:
        client_id = get_current_user_client_id()
        well = WellService.get_well(well_id, client_id=client_id)
        return jsonify(well_schema.dump(well)), 200
    except ValueError:
        return jsonify({"message": "Well not found"}), 404


@well_bp.route("/", methods=["POST"])
@permission_required("wells", "write")
def create_well(current_user_id):
    data = request.get_json()
    try:
        validated_data = well_schema.load(data)
    except Exception as err:
        return (
            jsonify(
                {
                    "message": "Validation error",
                    "errors": err.messages if hasattr(err, "messages") else str(err),
                }
            ),
            400,
        )
    well = WellService.create_well(validated_data, current_user_id)
    return jsonify(well_schema.dump(well)), 201


@well_bp.route("/<well_id>", methods=["PUT"])
@permission_required("wells", "write")
def update_well(current_user_id, well_id):
    data = request.get_json()
    client_id = get_current_user_client_id()
    try:
        well = WellService.get_well(well_id, client_id=client_id)
    except ValueError:
        return jsonify({"message": "Well not found"}), 404
    try:
        well_schema.load(data, partial=True, instance=well)
    except Exception as err:
        return (
            jsonify(
                {
                    "message": "Validation error",
                    "errors": err.messages if hasattr(err, "messages") else str(err),
                }
            ),
            400,
        )
    well = WellService.update_well(well, current_user_id)
    return jsonify(well_schema.dump(well)), 200


@well_bp.route("/<well_id>", methods=["DELETE"])
@permission_required("wells", "delete")
def delete_well(current_user_id, well_id):
    try:
        client_id = get_current_user_client_id()
        WellService.delete_well(well_id, client_id=client_id)
        return jsonify({"message": "Well deleted"}), 200
    except ValueError:
        return jsonify({"message": "Well not found"}), 404
