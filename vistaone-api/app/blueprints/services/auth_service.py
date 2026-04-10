from app.utils.util import encode_token, token_required
from app.blueprints.repository.auth_repository import LoginRepository
from app.utils.token_blacklist import blacklist
import os
from flask import request
from jose import jwt
import logging


# Load secret from environment
SECRET_KEY = os.environ.get('SECRET_KEY') or "custom key"

logger= logging.getLogger()

class LoginService:
    @staticmethod
    def login_user(email, password):
        user = LoginRepository.get_user_by_email(email)

        if user and user.check_password(password): # ensure password hash check
        # if user:
            logger.info(f"User logged in: {user.id}")
            token = encode_token(user.id)

            return {
                "status": "success",
                "message": "Successfully Logged In",
                "token": token
            }, 200

        return {"message": "Invalid email or password"}, 401
    

    @staticmethod
    @token_required
    def logout_user(user_id):
        logger.info(f"Logout attempt for user ID: {user_id}")

        # Extract token from request
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]

        if not token:
            return ({'message': 'Token is missing!'}), 401 

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        except Exception:
            return {"message": "Invalid token!"}, 401
        
        jti = data.get("jti")
        if jti:
                if jti in blacklist:
                    logger.warning(f"Attempted logout with already revoked token: {jti}")
                    return {"message": "Token has already been revoked!"}, 401
                blacklist.add(jti)
                logger.info(f"Token revoked for user {user_id}: token revoked {jti}")

        return {"status": "success", "message": "Successfully logged out"}, 200

