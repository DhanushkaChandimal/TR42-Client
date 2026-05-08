from flask import request, jsonify, Blueprint
from app.utils.util import role_required, permission_required
from app.blueprints.repository.role_repository import RoleRepository
from app.models.user import User
import logging

role_bp = Blueprint("role_bp", __name__)
logger = logging.getLogger(__name__)

MASTER = "MASTER"
BUILT_IN_ROLE_NAMES = {"MASTER", "ADMIN", "USER"}


@role_bp.route("", methods=["GET"])
@permission_required("users", "read")
def list_roles(user_id):
    user = User.query.get(user_id)
    roles = RoleRepository.get_roles_for_client(user.client_id)
    return jsonify([_serialize_role(r) for r in roles]), 200


@role_bp.route("", methods=["POST"])
@role_required(MASTER)
def create_role(user_id):
    """Create a new client-specific role."""
    user = User.query.get(user_id)
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()

    if not name:
        return jsonify({"message": "name is required"}), 400

    if name.upper() in BUILT_IN_ROLE_NAMES:
        return jsonify({"message": "Cannot use a built-in role name"}), 409
    if RoleRepository.get_custom_role_by_name(user.client_id, name):
        return jsonify({"message": "A role with this name already exists"}), 409

    role = RoleRepository.create_role(name, description, user.client_id)
    return jsonify(_serialize_role(role)), 201


@role_bp.route("/<role_id>", methods=["PUT"])
@role_required(MASTER)
def update_role(user_id, role_id):
    """Edit a custom (non-default) role."""
    user = User.query.get(user_id)
    role = RoleRepository.get_role_by_id(role_id)

    if not role or role.client_id != user.client_id:
        return jsonify({"message": "Role not found"}), 404
    if role.name.upper() in BUILT_IN_ROLE_NAMES:
        return jsonify({"message": "Built-in roles cannot be edited"}), 403

    data = request.get_json() or {}
    name = data.get("name", "").strip() or None
    description = data.get("description")

    if name and name != role.name:
        if name.upper() in BUILT_IN_ROLE_NAMES:
            return jsonify({"message": "Cannot use a built-in role name"}), 409
        if RoleRepository.get_custom_role_by_name(user.client_id, name):
            return jsonify({"message": "A role with this name already exists"}), 409

    RoleRepository.update_role(role, name=name, description=description)
    return jsonify(_serialize_role(role)), 200


@role_bp.route("/<role_id>", methods=["DELETE"])
@role_required(MASTER)
def delete_role(user_id, role_id):
    """Delete a custom role. Optionally migrate users to another role first."""
    user = User.query.get(user_id)
    role = RoleRepository.get_role_by_id(role_id)

    if not role or role.client_id != user.client_id:
        return jsonify({"message": "Role not found"}), 404
    if role.name.upper() in BUILT_IN_ROLE_NAMES:
        return jsonify({"message": "Built-in roles cannot be deleted"}), 403

    data = request.get_json() or {}
    migrate_to_role_id = data.get("migrate_to_role_id")

    if migrate_to_role_id:
        target_role = RoleRepository.get_role_by_id(migrate_to_role_id)
        if not target_role or target_role.client_id != user.client_id:
            return jsonify({"message": "Target role not found"}), 404
        if target_role.id == role.id:
            return jsonify({"message": "Cannot migrate to the same role"}), 400
        RoleRepository.migrate_users_from_role(role, target_role)

    RoleRepository.delete_role(role)
    return jsonify({"message": "Role deleted"}), 200


@role_bp.route("/<role_id>/permissions", methods=["GET"])
@role_required(MASTER)
def get_permissions(user_id, role_id):
    """Get permissions for a role."""
    user = User.query.get(user_id)
    role = RoleRepository.get_role_by_id(role_id)
    if not role or role.client_id != user.client_id:
        return jsonify({"message": "Role not found"}), 404

    return jsonify([_serialize_permission(p) for p in role.permissions]), 200


@role_bp.route("/<role_id>/permissions", methods=["PUT"])
@role_required(MASTER)
def set_permissions(user_id, role_id):
    """Replace all permissions for a role. Cannot change MASTER role permissions."""
    user = User.query.get(user_id)
    role = RoleRepository.get_role_by_id(role_id)
    if not role or role.client_id != user.client_id:
        return jsonify({"message": "Role not found"}), 404
    if role.name.upper() == "MASTER":
        return jsonify({"message": "MASTER role permissions cannot be changed"}), 403

    data = request.get_json() or {}
    permissions_data = data.get("permissions", [])

    RoleRepository.set_permissions(role, permissions_data)
    return jsonify([_serialize_permission(p) for p in role.permissions]), 200


def _serialize_role(r):
    return {
        "id": r.id,
        "name": r.name,
        "description": r.description,
        "is_default": r.is_default,
        "client_id": r.client_id,
        "permissions": [_serialize_permission(p) for p in r.permissions],
    }


def _serialize_permission(p):
    return {
        "id": p.id,
        "resource": p.resource,
        "can_read": p.can_read,
        "can_write": p.can_write,
        "can_delete": p.can_delete,
    }
