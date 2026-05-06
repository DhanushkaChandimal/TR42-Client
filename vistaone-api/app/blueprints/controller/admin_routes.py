from flask import request, jsonify, Blueprint
from app.utils.util import role_required
from app.blueprints.repository.user_repository import UserRepository
from app.blueprints.enum.enums import UserStatus
from app.models.user import User
import logging

admin_bp = Blueprint("admin_bp", __name__)
logger = logging.getLogger(__name__)

MASTER = "MASTER"
ADMIN = "ADMIN"


# ── User Management ──────────────────────────────────────────────────────────

@admin_bp.route("/users", methods=["GET"])
@role_required(MASTER, ADMIN)
def list_users(user_id):
    current_user = User.query.get(user_id)
    users = UserRepository.get_users_by_client(current_user.client_id)
    return jsonify([_serialize_user(u) for u in users]), 200


@admin_bp.route("/users/pending", methods=["GET"])
@role_required(MASTER, ADMIN)
def list_pending_users(user_id):
    current_user = User.query.get(user_id)
    users = UserRepository.get_pending_users_by_client(current_user.client_id)
    return jsonify([_serialize_user(u) for u in users]), 200


@admin_bp.route("/users/<target_user_id>/approve", methods=["POST"])
@role_required(MASTER, ADMIN)
def approve_user(user_id, target_user_id):
    current_user = User.query.get(user_id)
    target = UserRepository.get_user_by_id(target_user_id)
    if not target or target.client_id != current_user.client_id:
        return jsonify({"message": "User not found"}), 404
    if target.status != UserStatus.PENDING_APPROVAL:
        return jsonify({"message": "User is not pending approval"}), 400

    UserRepository.update_user_status(target, UserStatus.ACTIVE)
    return jsonify({"message": "User approved", "user_id": target.id}), 200


@admin_bp.route("/users/<target_user_id>/reject", methods=["POST"])
@role_required(MASTER, ADMIN)
def reject_user(user_id, target_user_id):
    current_user = User.query.get(user_id)
    target = UserRepository.get_user_by_id(target_user_id)
    if not target or target.client_id != current_user.client_id:
        return jsonify({"message": "User not found"}), 404
    if target.status not in (UserStatus.PENDING_APPROVAL, UserStatus.ACTIVE):
        return jsonify({"message": "Cannot reject this user"}), 400

    UserRepository.update_user_status(target, UserStatus.REJECTED)
    return jsonify({"message": "User rejected", "user_id": target.id}), 200


@admin_bp.route("/users/<target_user_id>", methods=["PUT"])
@role_required(MASTER, ADMIN)
def update_user(user_id, target_user_id):
    current_user = User.query.get(user_id)
    target = UserRepository.get_user_by_id(target_user_id)
    if not target or target.client_id != current_user.client_id:
        return jsonify({"message": "User not found"}), 404

    data = request.get_json() or {}
    UserRepository.update_user(target, data)
    return jsonify({"message": "User updated", "user": _serialize_user(target)}), 200


@admin_bp.route("/users/<target_user_id>/roles", methods=["PUT"])
@role_required(MASTER, ADMIN)
def set_user_roles(user_id, target_user_id):
    from app.models.permission import Permission
    current_user = User.query.get(user_id)
    target = UserRepository.get_user_by_id(target_user_id)
    if not target or target.client_id != current_user.client_id:
        return jsonify({"message": "User not found"}), 404

    data = request.get_json() or {}
    role_names = data.get("roles", [])

    current_role_names = {r.name.upper() for r in current_user.roles}
    role_names_upper = [n.upper() for n in role_names]
    is_master = "MASTER" in current_role_names

    # Only MASTER can assign MASTER role
    if "MASTER" in role_names_upper and not is_master:
        return jsonify({"message": "Only MASTER can assign the MASTER role"}), 403

    # Check if ADMIN is in requested roles — only MASTER or ADMIN-with-promote_admin can assign it
    if "ADMIN" in role_names_upper and not is_master:
        current_role_ids = [r.id for r in current_user.roles]
        can_promote = Permission.query.filter(
            Permission.role_id.in_(current_role_ids),
            Permission.resource == "promote_admin",
            Permission.can_write == True,
        ).first()
        if not can_promote:
            return jsonify({"message": "You do not have permission to assign the ADMIN role"}), 403

    # Prevent removing MASTER's own MASTER role via this endpoint (use transfer instead)
    if is_master and target.id == user_id and "MASTER" not in role_names_upper:
        return jsonify({"message": "Use the transfer endpoint to relinquish your MASTER role"}), 400

    UserRepository.set_user_roles(target, role_names, current_user.client_id)
    return jsonify({"message": "Roles updated", "roles": role_names}), 200


@admin_bp.route("/master/transfer", methods=["POST"])
@role_required(MASTER)
def transfer_master(user_id):
    """Transfer MASTER role to another user. Current user becomes ADMIN."""
    current_user = User.query.get(user_id)
    data = request.get_json() or {}
    target_user_id = data.get("target_user_id")
    if not target_user_id:
        return jsonify({"message": "target_user_id is required"}), 400

    target = UserRepository.get_user_by_id(target_user_id)
    if not target or target.client_id != current_user.client_id:
        return jsonify({"message": "Target user not found"}), 404
    if target.id == user_id:
        return jsonify({"message": "Cannot transfer MASTER role to yourself"}), 400
    if target.status != UserStatus.ACTIVE:
        return jsonify({"message": "Target user must be active"}), 400

    UserRepository.set_user_roles(target, ["MASTER"], current_user.client_id)
    UserRepository.set_user_roles(current_user, ["ADMIN"], current_user.client_id)
    return jsonify({"message": "MASTER role transferred successfully"}), 200


def _serialize_user(u):
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "contact_number": u.contact_number,
        "status": u.status.value if u.status else None,
        "roles": [r.name for r in u.roles],
    }
