from sqlalchemy.orm import mapped_column, relationship
import uuid
from app.extensions import db
from app.models.audit_mixin import AuditMixin


class FileAttachment(db.Model, AuditMixin):
    """Binary attachment stored inline on a message. Mirrors Neon's
    `file_attachment` shape (bytea content). Inline keeps deployment simple
    at the cost of DB size; small files (<10MB) only.
    """

    __tablename__ = "file_attachment"

    id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    message_id = mapped_column(
        db.String(36), db.ForeignKey("message.id"), nullable=False, index=True
    )
    filename = mapped_column(db.String(255), nullable=False)
    mime_type = mapped_column(db.String(100), nullable=False)
    content = mapped_column(db.LargeBinary, nullable=False)

    message = relationship("Message", back_populates="attachments")
