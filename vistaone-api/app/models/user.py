from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func, Date
from werkzeug.security import check_password_hash, generate_password_hash
from app.extensions import db
import uuid
from app.blueprints.enum.enums import UserType, UserStatus
from datetime import date, datetime


class User(db.Model):
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
    middle_name: Mapped[str] = mapped_column(db.String(80))
    last_name: Mapped[str] = mapped_column(db.String(80), nullable=False)
    profile_photo_url: Mapped[str] = mapped_column(db.String(255))
    date_of_birth: Mapped[date] = mapped_column(Date)
    ssn_last_four: Mapped[str] = mapped_column(db.CHAR(4))
    contact_number: Mapped[str] = mapped_column(db.String(30), nullable=False)
    alternate_number: Mapped[str] = mapped_column(db.String(30))

    company_id: Mapped[str] = mapped_column(
        db.String(36), db.ForeignKey("client.id"), nullable=False
    )
    company = db.relationship("Client", back_populates="users")

    address_id: Mapped[str] = mapped_column(
        db.String(36), db.ForeignKey("address.id"), nullable=False
    )
    address = db.relationship("Address", back_populates="users")

    created_by: Mapped[str] = mapped_column(db.String(36), db.ForeignKey("user.id"))
    creator = db.relationship(
        "User",
        foreign_keys=[created_by],
        remote_side=[id],
        back_populates="created_users",
    )

    updated_by: Mapped[str] = mapped_column(db.String(36), db.ForeignKey("user.id"))
    updater = db.relationship(
        "User",
        foreign_keys=[updated_by],
        remote_side=[id],
        back_populates="updated_users",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)
