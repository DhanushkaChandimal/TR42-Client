import jose
from jose import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify
import os
from app.utils.token_blacklist import blacklist
import logging

logger = logging.getLogger(__name__)

# Load secret from environment
SECRET_KEY = os.environ.get('SECRET_KEY') or "custom key"

def encode_token(user_id): #using unique pieces of info to make our tokens user specific
    payload = {
        'exp': datetime.now(timezone.utc) + timedelta(days=0,hours=1), #Setting the expiration time to an hour past now
        'iat': datetime.now(timezone.utc), #Issued at
        'sub': str(user_id), #This needs to be a string or the token will be malformed and won't be able to be decoded.
        'jti': str(user_id) + "-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")  # unique identifier for each token.
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    return token

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Look for the token in the Authorization header
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            # Decode the token
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            jti = data.get("jti")
            logger.info(f"Token jti: {jti}")
            if jti in blacklist: # revoked tokens cannot access routes.
                logger.warning(f"Attempted access with revoked token: {jti}")
                return jsonify({'message': 'Token has been revoked!'}), 401
            

            user_id = data['sub']  # Fetch the user ID
            logger.info(f"User ID: {user_id}")
        except jose.exceptions.ExpiredSignatureError:
             return jsonify({'message': 'Token has expired!'}), 401
        except jose.exceptions.JWTError:
             return jsonify({'message': 'Invalid token!'}), 401

        return f(user_id, *args, **kwargs)

    return decorated