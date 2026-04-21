from app.models.user import User
from app.extensions import db
from sqlalchemy.exc import SQLAlchemyError


class UserRepository:
    @staticmethod
    def get_user_by_email(email):
        return User.query.filter_by(email=email).first()

    @staticmethod
    def create_user(user: User):
        try:
            db.session.add(user)
            db.session.commit()
            return user
        except SQLAlchemyError:
            db.session.rollback()
            raise
