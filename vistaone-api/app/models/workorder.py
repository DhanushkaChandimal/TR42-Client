from sqlalchemy.orm import mapped_column, relationship, Mapped
from app.blueprints.enum.enums import (
    PriorityEnum,
    StatusEnum,
    FrequencyEnum,
    LocationTypeEnum,
)
import uuid
from app.extensions import db
from sqlalchemy import Sequence
from app.models.audit_mixin import AuditMixin


class WorkOrder(db.Model, AuditMixin):
    __tablename__ = "work_order"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    work_order_id = mapped_column(db.Integer, Sequence("work_order_id_seq"))

    client_id = mapped_column(db.String(36), db.ForeignKey("client.id"), nullable=False)
    vendor_id = mapped_column(db.String(36), db.ForeignKey("vendor.id"), nullable=False)
    service_type_id = mapped_column(
        db.String(36), db.ForeignKey("service_type.id"), nullable=False
    )

    description = mapped_column(db.String(500))

    location_type = mapped_column(db.Enum(LocationTypeEnum), nullable=False)

    well_id = mapped_column(
        db.String(36), db.ForeignKey("well.id")
    )  ## well table reference if location_type is WELL

    latitude = mapped_column(db.Float, nullable=True)
    longitude = mapped_column(db.Float, nullable=True)

    units = mapped_column(db.String(100))
    estimated_quantity = mapped_column(db.Float, nullable=True)

    priority = mapped_column(db.Enum(PriorityEnum), nullable=False)

    status = mapped_column(db.Enum(StatusEnum), default=StatusEnum.UNASSIGNED)

    is_recurring = mapped_column(db.Boolean, default=False)
    recurrence_type = mapped_column(
        db.Enum(FrequencyEnum), default=FrequencyEnum.ONE_TIME
    )

    estimated_start_date = mapped_column(db.DateTime, nullable=True)
    estimated_end_date = mapped_column(db.DateTime, nullable=True)
    cancelled_by = mapped_column(db.String(100))
    cancelled_date = mapped_column(db.DateTime)
    cancellation_reason = mapped_column(db.String(255), nullable=True)

    address_id = mapped_column(
        db.String(36), db.ForeignKey("address.id")
    )  ## address reference if location_type is ADDRESS

    ## Relationships
    client = relationship("Client", back_populates="workorders")
    vendor = relationship("Vendor", back_populates="workorders")
    service_type = relationship("ServiceType")
    well = relationship("Well")
    address = relationship("Address")
