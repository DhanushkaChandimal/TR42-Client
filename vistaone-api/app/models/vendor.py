from sqlalchemy.orm import mapped_column, relationship
from sqlalchemy.sql import func
import uuid
from app.extensions import db
from app.blueprints.enum.enums import VendorStatus, ComplianceStatus


class Vendor(db.Model):
    __tablename__ = "vendors"

    vendor_id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # "name" kept from original stub for work order relationship compatibility
    name = mapped_column(db.String(255), nullable=False)
    company_name = mapped_column(db.String(80), unique=True, nullable=True)
    company_code = mapped_column(db.String(50), nullable=True)

    primary_contact_name = mapped_column(db.String(255), nullable=True)
    company_email = mapped_column(db.String(255), nullable=True)
    company_phone = mapped_column(db.String(50), nullable=True)

    start_date = mapped_column(db.DateTime(timezone=True), nullable=True)
    end_date = mapped_column(db.DateTime(timezone=True), nullable=True)

    status = mapped_column(
        db.Enum(VendorStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=VendorStatus.INACTIVE,
    )
    compliance_status = mapped_column(
        db.Enum(ComplianceStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
        default=ComplianceStatus.INCOMPLETE,
    )

    vendor_code = mapped_column(db.String(50), unique=True, nullable=True)
    onboarding = mapped_column(db.Boolean, nullable=False, default=True)
    description = mapped_column(db.Text, nullable=True)

    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    address_id = mapped_column(db.String(36), db.ForeignKey("address.id"))
    address = relationship("Address")

    workorders = relationship("WorkOrder", back_populates="vendor")
