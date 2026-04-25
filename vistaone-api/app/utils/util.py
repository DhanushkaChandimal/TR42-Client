import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, g
import os
from app.utils.token_blacklist import blacklist
import logging

logger = logging.getLogger(__name__)

SECRET_KEY = os.environ.get("SECRET_KEY") or "custom key"


def encode_token(user_id):
    payload = {
        "exp": datetime.now(timezone.utc) + timedelta(days=0, hours=1),
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
        user_id = data["sub"]
        logger.info(f"User ID: {user_id}")
        return user_id, None
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
        return f(user_id, *args, **kwargs)

    return decorated
