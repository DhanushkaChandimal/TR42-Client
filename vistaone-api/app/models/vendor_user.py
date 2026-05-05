from sqlalchemy.orm import mapped_column, relationship
import uuid
from app.extensions import db
from app.models.audit_mixin import AuditMixin


class VendorUser(db.Model, AuditMixin):
    """Links an auth_user to a vendor.

    Mirrors the shape of Neon's `vendor_user` table so the messenger can
    discover which users are participants on the vendor side of a work order.
    """

    __tablename__ = "vendor_user"

    id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id = mapped_column(
        db.String(36), db.ForeignKey("auth_user.id"), nullable=False
    )
    vendor_id = mapped_column(
        db.String(36), db.ForeignKey("vendor.id"), nullable=True
    )
    vendor_user_role = mapped_column(db.String(50), nullable=True)

    user = relationship("User")
    vendor = relationship("Vendor")
