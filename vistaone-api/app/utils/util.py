import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, g
import os
from app.utils.token_blacklist import blacklist
import logging

logger = logging.getLogger(__name__)

SECRET_KEY = os.environ.get("SECRET_KEY") or "custom key"

ALL_RESOURCES = [
    "dashboard",
    "wells",
    "workorders",
    "vendors",
    "vendor_marketplace",
    "contracts",
    "invoices",
    "users",
    "promote_admin",
]


def encode_token(user_id):
    payload = {
        "exp": datetime.now(timezone.utc) + timedelta(days=0, hours=5),
        "iat": datetime.now(timezone.utc),
        "sub": str(user_id),
        "jti": str(user_id) + "-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def _decode_request_token():
    auth = request.headers.get("Authorization")
    if not auth:
        return None, (jsonify({"message": "Missing token"}), 401)
    try:
        scheme, token = auth.split()
        if scheme.lower() != "bearer":
            return None, (jsonify({"message": "Invalid auth format"}), 401)
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        jti = data.get("jti")
        logger.info(f"Token jti: {jti}")
        if jti in blacklist:
            logger.warning(f"Attempted access with revoked token: {jti}")
            return None, (jsonify({"message": "Token has been revoked!"}), 401)
        return data["sub"], None
    except jwt.ExpiredSignatureError:
        return None, (jsonify({"message": "Token has expired!"}), 401)
    except jwt.InvalidTokenError:
        return None, (jsonify({"message": "Invalid token!"}), 401)
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        return None, (jsonify({"message": "Token validation error!"}), 401)


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id, err = _decode_request_token()
        if err:
            return err
        g.current_user_id = user_id
        logger.info(f"Authenticated user: {user_id}")
        return f(user_id, *args, **kwargs)

    return decorated


def role_required(*allowed_roles):
    """Decorator that checks the user has at least one of the allowed role names."""

    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user_id, err = _decode_request_token()
            if err:
                return err
            g.current_user_id = user_id

            from app.models.user import User

            user = User.query.get(user_id)
            if not user:
                return jsonify({"message": "User not found"}), 404

            user_role_names = {r.name for r in user.roles}
            if not user_role_names.intersection(set(allowed_roles)):
                return jsonify({"message": "Insufficient permissions"}), 403

            return f(user_id, *args, **kwargs)

        return decorated

    return decorator


def get_user_permissions(user):
    """Return aggregated permissions dict for a user.
    MASTER gets full access on all resources.
    Others get their actual DB permissions.
    """
    role_names = {r.name for r in user.roles}
    if "MASTER" in role_names:
        return {
            res: {"read": True, "write": True, "delete": True} for res in ALL_RESOURCES
        }

    from app.blueprints.repository.permission_repository import PermissionRepository

    role_ids = [r.id for r in user.roles]
    return PermissionRepository.aggregate_permissions(role_ids)


_ACTION_LABELS = {
    "read": "view",
    "write": "create or modify",
    "delete": "delete",
}

_RESOURCE_LABELS = {
    "wells": "wells",
    "workorders": "work orders",
    "vendors": "vendors",
    "vendor_marketplace": "vendor marketplace",
    "contracts": "contracts",
    "invoices": "invoices",
    "users": "users",
    "dashboard": "dashboard",
    "promote_admin": "admin promotions",
}


def permission_required(resource, action="read"):
    """Decorator that checks the user has a specific permission on a resource.
    MASTER bypasses all checks.
    """

    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user_id, err = _decode_request_token()
            if err:
                return err
            g.current_user_id = user_id

            from app.models.user import User

            user = User.query.get(user_id)
            if not user:
                return jsonify({"message": "User not found"}), 404

            role_names = {r.name for r in user.roles}
            if "MASTER" not in role_names:
                perms = get_user_permissions(user)
                resource_perms = perms.get(resource, {})
                if not resource_perms.get(action, False):
                    action_label = _ACTION_LABELS.get(action, action)
                    resource_label = _RESOURCE_LABELS.get(resource, resource)
                    return jsonify({
                        "message": f"You do not have permission to {action_label} {resource_label}."
                    }), 403

            return f(user_id, *args, **kwargs)

        return decorated

    return decorator
