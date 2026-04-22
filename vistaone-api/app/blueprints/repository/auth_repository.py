from sqlalchemy import select
from app.extensions import db
from app.models import User


class LoginRepository:
    @staticmethod
    def get_user_by_email(email):
        if not email:
            return None

        query = select(User).where(User.email == email)
        user = db.session.execute(query).scalars().first()

        return user
