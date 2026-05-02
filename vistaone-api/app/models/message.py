from sqlalchemy.orm import mapped_column, relationship
import uuid
from app.extensions import db
from app.models.audit_mixin import AuditMixin


class Message(db.Model, AuditMixin):
    """One message inside a chat. Mirrors Neon's `message` shape exactly."""

    __tablename__ = "message"

    id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    chat_id = mapped_column(
        db.String(36), db.ForeignKey("chat.id"), nullable=False, index=True
    )
    sender_id = mapped_column(
        db.String(36), db.ForeignKey("auth_user.id"), nullable=False
    )
    recipient_id = mapped_column(
        db.String(36), db.ForeignKey("auth_user.id"), nullable=False
    )
    body = mapped_column(db.Text, nullable=False)

    chat = relationship("Chat", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
    attachments = relationship(
        "FileAttachment", back_populates="message", cascade="all, delete-orphan"
    )
