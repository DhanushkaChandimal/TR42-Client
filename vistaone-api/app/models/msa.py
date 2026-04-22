from sqlalchemy.orm import mapped_column, relationship
from sqlalchemy.sql import func
import uuid
from app.extensions import db


class Msa(db.Model):
    __tablename__ = "msa"

    id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    vendor_id = mapped_column(db.String(36), db.ForeignKey("vendor.id"), nullable=False)
    version = mapped_column(db.String(10), nullable=True)
    effective_date = mapped_column(db.Date, nullable=True)
    expiration_date = mapped_column(db.Date, nullable=True)
    status = mapped_column(db.String(15), nullable=False, default="active")
    uploaded_by = mapped_column(db.String(100), nullable=True)
    file_name = mapped_column(db.String(255), nullable=True)
    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    ## Relationships
    vendor = relationship("Vendor")
