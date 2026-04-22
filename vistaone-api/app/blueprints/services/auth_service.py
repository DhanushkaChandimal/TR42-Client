from app.blueprints.repository.user_repository import UserRepository
from app.blueprints.repository.address_repository import AddressRepository
from app.models.user import User
from app.blueprints.enum.enums import UserStatus, UserType
from app.utils.email_util import send_verification_email
from flask import current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from app.utils.util import encode_token, token_required
from app.blueprints.repository.auth_repository import LoginRepository
from app.utils.token_blacklist import blacklist
import os
from flask import request
import jwt
import logging


# Load secret from environment
SECRET_KEY = os.environ.get("SECRET_KEY") or "custom key"
logger = logging.getLogger()


class LoginService:
    @staticmethod
    def login_user(email, password):
        user = LoginRepository.get_user_by_email(email)

        if not user or not user.check_password(password):
            return {"message": "Invalid email or password"}, 401

        match user.status:
            case UserStatus.PENDING_EMAIL_VERIFICATION:
                return {
                    "message": "Please verify your email address before logging in. Check your inbox for the verification link."
                }, 403
            case UserStatus.PENDING_APPROVAL:
                return {
                    "message": "Your account is pending approval by an administrator."
                }, 403
            case UserStatus.REJECTED:
                return {
                    "message": "Your account registration was rejected. Please contact support."
                }, 403
            case UserStatus.INACTIVE:
                return {
                    "message": "Your account is inactive. Please contact support."
                }, 403
            case UserStatus.DELETED:
                return {"message": "Your account has been deleted."}, 403
            case UserStatus.ACTIVE:
                logger.info(f"User logged in: {user.id}")
                token = encode_token(user.id)
                return {
                    "status": "success",
                    "message": "Successfully Logged In",
                    "token": token,
                }, 200
            case _:
                return {"message": "Your account is not active."}, 403

    @staticmethod
    @token_required
    def logout_user(user_id):
        logger.info(f"Logout attempt for user ID: {user_id}")

        # Extract token from request
        token = None
        if "Authorization" in request.headers:
            token = request.headers["Authorization"].split(" ")[1]

        if not token:
            return ({"message": "Token is missing!"}), 401

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
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

    @staticmethod
    def register_user(user_data):
        # Check for duplicate email
        existing_user = UserRepository.get_user_by_email(user_data["email"])
        if existing_user:
            return {"message": "A user with this email is already registered."}, 409

        # Check for duplicate username
        from app.models.user import User as UserModel

        if UserModel.query.filter_by(username=user_data["username"]).first():
            return {"message": "A user with this username is already registered."}, 409

        address_fields = ["street", "city", "state", "zip", "country"]
        address_data = {}
        if "address" in user_data and isinstance(user_data["address"], dict):
            for k in address_fields:
                address_data[k] = user_data["address"].get(k, "")
        else:
            for k in address_fields:
                address_data[k] = ""
        # Get or create address
        address = AddressRepository.get_or_create_address(address_data)
        user_data["address_id"] = address.id
        password = user_data.pop("password", None)
        user_data["status"] = UserStatus.PENDING_EMAIL_VERIFICATION

        user_data["user_type"] = UserType.CLIENT
        user_data.pop("address", None)
        user = User(**user_data)
        if password:
            user.set_password(password)
        created_user = UserRepository.create_user(user)
        # Generate a token for email verification
        s = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
        token = s.dumps(created_user.email, salt="email-verify")
        send_verification_email(created_user, token)
        return created_user, 201

    @staticmethod
    def verify_email(token):
        s = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
        if not token:
            return {"message": "Missing token"}, 400
        try:
            email = s.loads(token, salt="email-verify", max_age=3600 * 24)
        except SignatureExpired:
            return {"message": "Token expired"}, 400
        except BadSignature:
            return {"message": "Invalid token"}, 400
        user = UserRepository.get_user_by_email(email)
        if not user:
            return {"message": "User not found"}, 404
        # Set user status to ACTIVE after email verification
        UserRepository.update_user_status(user, UserStatus.ACTIVE)
        return {"message": "Email verified", "status": user.status.value}, 200
