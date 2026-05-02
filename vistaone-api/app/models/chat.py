from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import mapped_column, relationship
import uuid
from app.extensions import db
from app.models.audit_mixin import AuditMixin


class Chat(db.Model, AuditMixin):
    """Strictly 1-on-1 conversation between two users. Mirrors Neon's `chat`
    shape exactly: just the two participants and audit columns.

    `user_one_id` and `user_two_id` are stored canonically (lower id first)
    by the service layer so the unique constraint can dedupe regardless of
    who initiated. WO context is supplied at navigation time, not persisted
    on the row.
    """

    __tablename__ = "chat"

    id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_one_id = mapped_column(
        db.String(36), db.ForeignKey("auth_user.id"), nullable=False
    )
    user_two_id = mapped_column(
        db.String(36), db.ForeignKey("auth_user.id"), nullable=False
    )

    user_one = relationship("User", foreign_keys=[user_one_id])
    user_two = relationship("User", foreign_keys=[user_two_id])
    messages = relationship(
        "Message", back_populates="chat", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "user_one_id",
            "user_two_id",
            name="uq_chat_pair",
        ),
    )
