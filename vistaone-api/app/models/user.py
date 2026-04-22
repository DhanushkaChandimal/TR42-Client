from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Date
from werkzeug.security import check_password_hash, generate_password_hash
from app.extensions import db
import uuid
from app.blueprints.enum.enums import UserType, UserStatus
from datetime import date
from app.models.audit_mixin import AuditMixin


class User(db.Model, AuditMixin):
    __tablename__ = "user"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    username: Mapped[str] = mapped_column(db.String(40), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(db.String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(db.String(255), nullable=False)
    user_type: Mapped[UserType] = mapped_column(db.Enum(UserType), nullable=False)
    status: Mapped[UserStatus] = mapped_column(db.Enum(UserStatus), nullable=False)
    first_name: Mapped[str] = mapped_column(db.String(80), nullable=False)
    middle_name: Mapped[str] = mapped_column(db.String(80), nullable=True)
    last_name: Mapped[str] = mapped_column(db.String(80), nullable=False)
    profile_photo_url: Mapped[str] = mapped_column(db.String(255), nullable=True)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=True)
    ssn_last_four: Mapped[str] = mapped_column(db.CHAR(4), nullable=True)
    contact_number: Mapped[str] = mapped_column(db.String(30), nullable=False)
    alternate_number: Mapped[str] = mapped_column(db.String(30), nullable=True)

    client_id: Mapped[str] = mapped_column(
        db.String(36), db.ForeignKey("client.id"), nullable=False
    )
    client = db.relationship("Client", foreign_keys=[client_id], back_populates="users")

    address_id: Mapped[str] = mapped_column(
        db.String(36), db.ForeignKey("address.id"), nullable=False
    )
    address = db.relationship("Address", foreign_keys=[address_id])

    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)
