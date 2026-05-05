import uuid
from sqlalchemy.orm import Mapped, mapped_column
from app.extensions import db


class Permission(db.Model):
    __tablename__ = "permission"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    role_id: Mapped[str] = mapped_column(
        db.String(36), db.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
    )
    resource: Mapped[str] = mapped_column(db.String(100), nullable=False)
    can_read: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    can_write: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    can_delete: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)

    role = db.relationship("Role", back_populates="permissions")

    __table_args__ = (
        db.UniqueConstraint("role_id", "resource", name="uq_permission_role_resource"),
    )
