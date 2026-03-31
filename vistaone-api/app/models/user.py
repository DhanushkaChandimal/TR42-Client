# from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func
from werkzeug.security import check_password_hash, generate_password_hash
from . import Base, db


class User(Base):
    __tablename__ = 'users'
    
    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(db.String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(db.String(255), nullable=False)
    email: Mapped[str] = mapped_column(db.String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(db.String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(nullable=False)
    company_id: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)
