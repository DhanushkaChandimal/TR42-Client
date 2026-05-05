import uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.extensions import db


user_role = db.Table(
    "user_role",
    db.Column("user_id", db.String(36), db.ForeignKey("auth_user.id"), primary_key=True),
    db.Column("role_id", db.String(36), db.ForeignKey("roles.id"), primary_key=True),
)


class Role(db.Model):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(db.String(50), nullable=False)
    description: Mapped[str] = mapped_column(db.String(255), nullable=True)
    is_default: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    client_id: Mapped[str] = mapped_column(
        db.String(36),
        db.ForeignKey("client.id", ondelete="CASCADE"),
        nullable=True,
    )

    users = relationship("User", secondary=user_role, back_populates="roles")
    permissions = relationship(
        "Permission", back_populates="role", cascade="all, delete-orphan"
    )
