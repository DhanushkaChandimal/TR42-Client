from app.utils.util import encode_token
from app.blueprints.repository.auth_repository import LoginRepository

class LoginService:
    @staticmethod
    def login_user(email, password):
        user = LoginRepository.get_user_by_email(email)

        if user and user.check_password(password):
            
            token = encode_token(user.id)

            return {
                "status": "success",
                "message": "Successfully Logged In",
                "token": token
            }, 200

        return {"message": "Invalid email or password"}, 401