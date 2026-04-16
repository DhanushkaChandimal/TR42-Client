from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import mapped_column, relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.extensions import db


# Client model - stub for work order FK reference
# Will be expanded when full client features are built
class Client(db.Model):
    __tablename__ = "clients"

    client_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = mapped_column(db.String(255), nullable=False)
    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    workorders = relationship("WorkOrder", back_populates="client")

    address_id = mapped_column(db.String(36), db.ForeignKey("address.address_id"))
    address = relationship("Address")


# ERD vendor_status enum - stored as lowercase strings
# Values match what the frontend badge checks expect (e.g. vendor.status === 'active')
class VendorStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

    def __str__(self):
        return self.value


# ERD compliance_status enum - stored as lowercase strings
class ComplianceStatus(str, enum.Enum):
    EXPIRED = "expired"
    INCOMPLETE = "incomplete"
    COMPLETE = "complete"

    def __str__(self):
        return self.value


# Vendor model - expanded from stub to match ERD vendor table
# Table name stays "vendors" because work_orders already has a FK to vendors.vendor_id
# ERD defines table as "vendor" (singular) but renaming would break the existing FK
# The "name" column is kept for backward compatibility with work order relationships
# New fields follow the ERD column names directly
#
# NOTE: After pulling this branch, run the following to add new columns to an existing DB:
#   psql client_web_dashboard_db -c "DROP TABLE vendors CASCADE;"
#   Then restart the app so db.create_all() rebuilds it
#   You will also need to recreate work_orders since it has a FK to vendors
class Vendor(db.Model):
    __tablename__ = "vendors"

    # Primary key - UUID string per ERD
    vendor_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # "name" kept from original stub for work order relationship compatibility
    # "company_name" is the ERD field name - used by vendor API going forward
    name = mapped_column(db.String(255), nullable=False)
    company_name = mapped_column(db.String(80), unique=True, nullable=True)
    company_code = mapped_column(db.String(50), nullable=True)

    # Contact fields per ERD
    primary_contact_name = mapped_column(db.String(255), nullable=True)
    company_email = mapped_column(db.String(255), nullable=True)
    company_phone = mapped_column(db.String(50), nullable=True)

    # Dates for vendor contract period
    start_date = mapped_column(db.DateTime(timezone=True), nullable=True)
    end_date = mapped_column(db.DateTime(timezone=True), nullable=True)

    # Status fields - using enums that store lowercase values
    status = mapped_column(
        db.Enum(VendorStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=VendorStatus.INACTIVE
    )
    compliance_status = mapped_column(
        db.Enum(ComplianceStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
        default=ComplianceStatus.INCOMPLETE
    )

    # ERD fields
    vendor_code = mapped_column(db.String(50), nullable=True)
    onboarding = mapped_column(db.Boolean, nullable=False, default=True)
    service_type = mapped_column(db.String(255), nullable=True)
    description = mapped_column(db.Text, nullable=True)

    # Audit fields - keeping the original column names from the stub
    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    # FK to address table
    address_id = mapped_column(db.String(36), db.ForeignKey("address.address_id"))
    address = relationship("Address")

    # Existing relationship from work order model
    workorders = relationship("WorkOrder", back_populates="vendor")


# ServiceType model - stub for work order FK reference
# ERD defines a "services" table - will be expanded in a separate feature branch
class ServiceType(db.Model):
    __tablename__ = "service_types"

    service_type_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    service = mapped_column(db.String(255), nullable=False)
    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    workorders = relationship("WorkOrder", back_populates="service_type")