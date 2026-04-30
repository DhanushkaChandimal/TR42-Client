from app.blueprints.repository.user_repository import UserRepository
from app.extensions import db
from app.blueprints.repository.address_repository import AddressRepository
from app.models.user import User
from app.blueprints.enum.enums import UserStatus, UserType
from app.utils.email_util import send_verification_email
from flask import current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from app.utils.util import encode_token
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
        client_id = user_data.pop("client_id", None)
        user_data.pop("status", None)

        user_data["user_type"] = UserType.CLIENT
        user_data.pop("address", None)
        user = User(**user_data)
        if password:
            user.set_password(password)

        try:
            # Assign the default role (USER) for the user's company
            if client_id:
                from app.models.role import Role
                default_role = Role.query.filter_by(client_id=client_id, is_default=True).first()
                if default_role:
                    user.roles.append(default_role)

            db.session.add(user)
            db.session.flush()

            if client_id:
                from app.models.client_user import ClientUser
                client_user_rec = ClientUser(
                    user_id=user.id,
                    client_id=client_id,
                    status=UserStatus.PENDING_EMAIL_VERIFICATION,
                )
                db.session.add(client_user_rec)
                db.session.flush()

            s = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
            token = s.dumps(user.email, salt="email-verify")
            send_verification_email(user, token)

            db.session.commit()
        except Exception:
            db.session.rollback()
            raise

        return user, 201

    @staticmethod
    def register_client(client_data):
        from app.blueprints.repository.client_repository import ClientRepository
        from app.models.client import Client
        from app.models.user import User
        from app.models.role import Role
        from app.extensions import db

        if ClientRepository.get_client_by_email(client_data["company_email"]):
            return {"message": "A client with this email is already registered."}, 409

        if ClientRepository.get_client_by_code(client_data["client_code"]):
            return {"message": "A client with this code is already registered."}, 409

        admin_data = client_data.pop("admin_user")

        if UserRepository.get_user_by_email(admin_data["email"]):
            return {"message": "A user with this email is already registered."}, 409

        if User.query.filter_by(username=admin_data["username"]).first():
            return {"message": "A user with this username is already registered."}, 409

        try:
            from seed import init_company_roles

            address_data = client_data.pop("address", {})
            address = AddressRepository.get_or_create_address(address_data)

            client_data["address_id"] = address.id
            client = Client(**client_data)
            db.session.add(client)
            db.session.flush()

            # Create MASTER, ADMIN, USER roles for this company
            init_company_roles(client.id)

            master_role = Role.query.filter_by(name="MASTER", client_id=client.id).first()

            password = admin_data.pop("password")
            admin_user = User(
                **admin_data,
                address_id=address.id,
                user_type=UserType.CLIENT,
            )
            admin_user.set_password(password)
            if master_role:
                admin_user.roles.append(master_role)
            db.session.add(admin_user)
            db.session.flush()

            from app.models.client_user import ClientUser
            admin_client_user = ClientUser(
                user_id=admin_user.id,
                client_id=client.id,
                status=UserStatus.PENDING_EMAIL_VERIFICATION,
            )
            db.session.add(admin_client_user)
            db.session.commit()

        except Exception:
            db.session.rollback()
            raise

        s = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
        token = s.dumps(admin_user.email, salt="email-verify")
        try:
            send_verification_email(admin_user, token)
        except Exception:
            logger.error(f"Verification email failed for {admin_user.email}")

        return client, 201

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

        # Master accounts are always activated immediately after email confirmation
        new_status = UserStatus.PENDING_APPROVAL
        if any(role.name == "MASTER" for role in user.roles):
            new_status = UserStatus.ACTIVE
        elif user.client_id:
            from app.models.client import Client
            client = Client.query.get(user.client_id)
            if client and client.approved_domain:
                email_domain = email.split("@")[-1].lower()
                if email_domain == client.approved_domain.lower():
                    new_status = UserStatus.ACTIVE

        UserRepository.update_user_status(user, new_status)
        return {"message": "Email verified", "status": user.status.value}, 200
