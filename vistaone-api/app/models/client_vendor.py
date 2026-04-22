from sqlalchemy.orm import mapped_column, relationship
from sqlalchemy.sql import func
import uuid
from app.extensions import db


class ClientVendor(db.Model):
    __tablename__ = "client_vendors"

    id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    client_id = mapped_column(
        db.String(36), db.ForeignKey("clients.client_id"), nullable=False
    )
    vendor_id = mapped_column(
        db.String(36), db.ForeignKey("vendors.vendor_id"), nullable=False
    )
    created_by = mapped_column(db.String(100), nullable=False)
    created_date = mapped_column(db.DateTime, server_default=func.now())
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    ## Relationships
    client = relationship("Client")
    vendor = relationship("Vendor")

    __table_args__ = (
        db.UniqueConstraint("client_id", "vendor_id", name="uq_client_vendor"),
    )
