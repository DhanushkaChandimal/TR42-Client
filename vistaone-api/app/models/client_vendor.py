from sqlalchemy.orm import mapped_column, relationship
import uuid
from app.extensions import db
from app.models.audit_mixin import AuditMixin


class ClientVendor(db.Model, AuditMixin):
    __tablename__ = "client_vendor"

    id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    client_id = mapped_column(db.String(36), db.ForeignKey("client.id"), nullable=False)
    vendor_id = mapped_column(db.String(36), db.ForeignKey("vendor.id"), nullable=False)
    created_by = mapped_column(db.String(100), nullable=False)

    ## Relationships
    client = relationship("Client")
    vendor = relationship("Vendor")

    __table_args__ = (
        db.UniqueConstraint("client_id", "vendor_id", name="uq_client_vendor"),
    )
