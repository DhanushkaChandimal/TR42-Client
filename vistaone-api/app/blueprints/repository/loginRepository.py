from sqlalchemy import select
from app.models import db, User

class LoginRepository:
    @staticmethod
    def get_user_by_email(email):

        query = select(User).where(User.email == email)
        user = db.session.execute(query).scalars().first()
        print(f"Queried user: {user}")

        return user