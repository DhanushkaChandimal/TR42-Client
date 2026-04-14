import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify
import os
from app.utils.token_blacklist import blacklist
import logging

logger = logging.getLogger(__name__)

# Load secret from environment
SECRET_KEY = os.environ.get("SECRET_KEY") or "custom key"


def encode_token(
    user_id,
):  # using unique pieces of info to make our tokens user specific
    payload = {
        "exp": datetime.now(timezone.utc)
        + timedelta(days=0, hours=1),  # Setting the expiration time to an hour past now
        "iat": datetime.now(timezone.utc),  # Issued at
        "sub": str(
            user_id
        ),  # This needs to be a string or the token will be malformed and won't be able to be decoded.
        "jti": str(user_id)
        + "-"
        + datetime.now(timezone.utc).strftime(
            "%Y%m%d%H%M%S"
        ),  # unique identifier for each token.
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return token


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):

        auth = request.headers.get("Authorization")

        if not auth:
            return jsonify({"message": "Missing token"}), 401

        try:
            scheme, token = auth.split()

            if scheme.lower() != "bearer":
                return jsonify({"message": "Invalid auth format"}), 401

            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])

            return f(data["sub"], *args, **kwargs)

        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token expired"}), 401

        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401

        except Exception as e:
            return jsonify({"message": str(e)}), 401

    return decorated
