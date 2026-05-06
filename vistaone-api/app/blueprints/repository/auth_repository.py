from sqlalchemy import select
from app.extensions import db
from app.models import User


class LoginRepository:
    @staticmethod
    def get_user_by_email(email):
        if not email:
            return None
        return db.session.execute(select(User).where(User.email == email)).scalars().first()

    @staticmethod
    def get_user_by_username(username):
        if not username:
            return None
        return db.session.execute(select(User).where(User.username == username)).scalars().first()

    @staticmethod
    def get_user_by_identifier(identifier):
        """Resolve email or username to a User. Treats input as email if it contains '@'."""
        if not identifier:
            return None
        if '@' in identifier:
            return LoginRepository.get_user_by_email(identifier)
        return LoginRepository.get_user_by_username(identifier)
