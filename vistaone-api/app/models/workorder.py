from sqlalchemy.orm import mapped_column, relationship, Mapped
from app.blueprints.enum.enums import (
    PriorityEnum,
    StatusEnum,
    FrequencyEnum,
    LocationTypeEnum,
)
import uuid
from app.extensions import db
from app.models.audit_mixin import AuditMixin


class WorkOrder(db.Model, AuditMixin):
    __tablename__ = "work_order"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    work_order_code = mapped_column(db.Integer, unique=True, nullable=True)

    client_id = mapped_column(db.String(36), db.ForeignKey("client.id"), nullable=False)
    assigned_vendor = mapped_column(
        db.String(36), db.ForeignKey("vendor.id"), nullable=True
    )
    service_type = mapped_column(
        db.String(36), db.ForeignKey("service.id"), nullable=False
    )

    description = mapped_column(db.Text)
    comments = mapped_column(db.String(500), nullable=True)
    location = mapped_column(db.String(100), nullable=True)
    location_type = mapped_column(db.Enum(LocationTypeEnum), nullable=True)

    well_id = mapped_column(db.String(36), db.ForeignKey("well.id"))

    latitude = mapped_column(db.Numeric, nullable=True)
    longitude = mapped_column(db.Numeric, nullable=True)

    units = mapped_column(db.String(15))
    estimated_quantity = mapped_column(db.Float, nullable=True)
    estimated_cost = mapped_column(db.Numeric, nullable=True)
    estimated_duration = mapped_column(db.Interval, nullable=True)

    priority = mapped_column(db.Enum(PriorityEnum), nullable=False)

    current_status = mapped_column(
        db.Enum(StatusEnum), nullable=False, default=StatusEnum.UNASSIGNED
    )

    is_recurring = mapped_column(db.Boolean, default=False)
    recurrence_type = mapped_column(
        db.Enum(FrequencyEnum), default=FrequencyEnum.ONE_TIME
    )

    estimated_start_date = mapped_column(db.DateTime(timezone=True), nullable=True)
    estimated_end_date = mapped_column(db.DateTime(timezone=True), nullable=True)
    assigned_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    completed_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    closed_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    halted_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    rejected_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    cancelled_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    cancelled_by = mapped_column(db.String(36), nullable=True)
    cancellation_reason = mapped_column(db.Text, nullable=True)

    client = relationship("Client", back_populates="workorders")
    vendor = relationship("Vendor", back_populates="workorders", foreign_keys=[assigned_vendor])
    service = relationship("Service", foreign_keys=[service_type])
    well = relationship("Well")
    tickets = relationship(
        "Ticket", back_populates="work_order", cascade="all, delete-orphan"
    )
