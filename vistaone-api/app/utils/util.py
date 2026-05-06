import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, g
import os
from app.utils.token_blacklist import blacklist
import logging

logger = logging.getLogger(__name__)

SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set")

# Tokens are signed with JWT_SECRET so they validate against Supabase Realtime
# / RLS (set JWT_SECRET to the project's Supabase JWT secret in any env that
# talks to Supabase). Falls back to SECRET_KEY for environments not pointed at
# Supabase, so local dev without Realtime keeps working.
JWT_SECRET = os.environ.get("JWT_SECRET") or SECRET_KEY

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
    "analytics",
    "fraud",
    "messages",
]


def encode_token(user_id, client_id=None):
    """Issue a JWT for the given user. The client_id ('cid') claim is included
    so tenant scoping can travel with the token — every authenticated request
    knows which client the caller belongs to without an extra DB lookup.
    """
    payload = {
        "exp": datetime.now(timezone.utc) + timedelta(days=0, hours=5),
        "iat": datetime.now(timezone.utc),
        "sub": str(user_id),
        "jti": str(user_id) + "-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
        # Supabase Realtime / RLS reads role + aud to pick the Postgres role
        # that evaluates row-level policies. authenticated is the Supabase
        # default for logged-in users.
        "role": "authenticated",
        "aud": "authenticated",
    }
    if client_id:
        payload["cid"] = str(client_id)
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _decode_request_token():
    auth = request.headers.get("Authorization")
    if not auth:
        return None, None, (jsonify({"message": "Missing token"}), 401)
    try:
        scheme, token = auth.split()
        if scheme.lower() != "bearer":
            return None, None, (jsonify({"message": "Invalid auth format"}), 401)
        # We don't pass an audience here so tokens issued before the aud claim
        # was added (and bare tokens used in dev) keep validating. The aud
        # claim is solely for Supabase Realtime / RLS, which validates it
        # itself when the JS client connects.
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
        jti = data.get("jti")
        logger.info(f"Token jti: {jti}")
        if jti in blacklist:
            logger.warning(f"Attempted access with revoked token: {jti}")
            return None, None, (jsonify({"message": "Token has been revoked!"}), 401)
        return data["sub"], data.get("cid"), None
    except jwt.ExpiredSignatureError:
        return None, None, (jsonify({"message": "Token has expired!"}), 401)
    except jwt.InvalidTokenError:
        return None, None, (jsonify({"message": "Invalid token!"}), 401)
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        return None, None, (jsonify({"message": "Token validation error!"}), 401)


def _ensure_current_client_id(user_id):
    """Guarantee g.current_client_id is populated. New tokens carry it as a
    'cid' claim; legacy tokens fall back to a one-time DB lookup. Idempotent.
    """
    if getattr(g, "current_client_id", None):
        return

    from app.models.user import User

    user = User.query.get(user_id)
    if user and user.client_id:
        g.current_client_id = user.client_id


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id, client_id, err = _decode_request_token()
        if err:
            return err
        g.current_user_id = user_id
        g.current_client_id = client_id
        _ensure_current_client_id(user_id)
        logger.info(f"Authenticated user: {user_id}")
        return f(user_id, *args, **kwargs)

    return decorated


def role_required(*allowed_roles):
    """Decorator that checks the user has at least one of the allowed role names."""

    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user_id, client_id, err = _decode_request_token()
            if err:
                return err
            g.current_user_id = user_id
            g.current_client_id = client_id
            _ensure_current_client_id(user_id)

            from app.models.user import User

            user = User.query.get(user_id)
            if not user:
                return jsonify({"message": "User not found"}), 404

            user_role_names = {r.name.upper() for r in user.roles}
            if not user_role_names.intersection({r.upper() for r in allowed_roles}):
                return jsonify({"message": "Insufficient permissions"}), 403

            return f(user_id, *args, **kwargs)

        return decorated

    return decorator


def get_current_user_client_id():
    """Return the caller's client_id, populated on flask.g by the auth
    decorators. Returns None outside a request context or for users with no
    associated client.
    """
    return getattr(g, "current_client_id", None)


def get_user_permissions(user):
    """Return aggregated permissions dict for a user.
    MASTER gets full access on all resources.
    Others get their actual DB permissions.
    """
    role_names = {r.name.upper() for r in user.roles}
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
    "analytics": "analytics",
    "fraud": "fraud detection",
    "messages": "messages",
}


def permission_required(resource, action="read"):
    """Decorator that checks the user has a specific permission on a resource.
    MASTER bypasses all checks.
    """

    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user_id, client_id, err = _decode_request_token()
            if err:
                return err
            g.current_user_id = user_id
            g.current_client_id = client_id
            _ensure_current_client_id(user_id)

            from app.models.user import User

            user = User.query.get(user_id)
            if not user:
                return jsonify({"message": "User not found"}), 404

            role_names = {r.name.upper() for r in user.roles}
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
