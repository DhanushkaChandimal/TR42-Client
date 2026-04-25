from sqlalchemy.orm import mapped_column, relationship, Mapped
import uuid
from app.extensions import db
from app.blueprints.enum.enums import PriorityEnum, TicketStatusEnum
from app.models.audit_mixin import AuditMixin


class Ticket(db.Model, AuditMixin):
    __tablename__ = "ticket"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    work_order_id = mapped_column(
        db.String(36), db.ForeignKey("work_order.id"), nullable=False
    )
    invoice_id = mapped_column(
        db.String(36), db.ForeignKey("invoice.id"), nullable=True
    )
    description = mapped_column(db.Text, nullable=False)
    # FK to contractor.id once Contractor model exists
    assigned_contractor = mapped_column(db.String(255), nullable=True)
    priority = mapped_column(db.Enum(PriorityEnum), nullable=False)
    status = mapped_column(
        db.Enum(TicketStatusEnum),
        nullable=False,
        default=TicketStatusEnum.UNASSIGNED,
    )
    vendor_id = mapped_column(
        db.String(36), db.ForeignKey("vendor.id"), nullable=False
    )

    start_time = mapped_column(db.DateTime(timezone=True), nullable=True)
    due_date = mapped_column(db.DateTime(timezone=True), nullable=False)
    assigned_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    end_time = mapped_column(db.DateTime(timezone=True), nullable=True)
    estimated_duration = mapped_column(db.Interval, nullable=True)

    service_type = mapped_column(
        db.String(36), db.ForeignKey("service_type.id"), nullable=False
    )

    notes = mapped_column(db.Text, nullable=True)
    contractor_start_location = mapped_column(db.Text, nullable=True)
    contractor_end_location = mapped_column(db.Text, nullable=True)
    estimated_quantity = mapped_column(db.Float, nullable=True)
    unit = mapped_column(db.String(100), nullable=True)
    special_requirements = mapped_column(db.Text, nullable=True)
    anomaly_flag = mapped_column(db.Boolean, nullable=True, default=False)
    anomaly_reason = mapped_column(db.Text, nullable=True)
    additional_information = mapped_column(db.JSON, nullable=True)
    route = mapped_column(db.Text, nullable=True)

    work_order = relationship("WorkOrder", back_populates="tickets")
    vendor = relationship("Vendor")
    invoice = relationship("Invoice")
    service = relationship("ServiceType", foreign_keys=[service_type])
