from sqlalchemy.orm import mapped_column, relationship
import uuid
from app.extensions import db
from app.models.audit_mixin import AuditMixin


class VendorService(db.Model, AuditMixin):
    __tablename__ = "vendor_service"

    id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    vendor_id = mapped_column(db.String(36), db.ForeignKey("vendor.id"), nullable=False)
    service_id = mapped_column(
        db.String(36), db.ForeignKey("service.id"), nullable=False
    )

    ## Relationships
    vendor = relationship("Vendor", back_populates="vendor_services")
    service = relationship("Service", back_populates="vendor_services")

    __table_args__ = (
        db.UniqueConstraint("vendor_id", "service_id", name="uq_vendor_service"),
    )
