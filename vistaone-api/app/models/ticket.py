from sqlalchemy.orm import mapped_column, relationship, Mapped
from sqlalchemy import Sequence
import uuid
from app.extensions import db
from app.blueprints.enum.enums import TicketStatusEnum
from app.models.audit_mixin import AuditMixin


class Ticket(db.Model, AuditMixin):
    __tablename__ = "ticket"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    ticket_number = mapped_column(db.Integer, Sequence("ticket_number_seq"))

    work_order_id = mapped_column(
        db.String(36), db.ForeignKey("work_order.id"), nullable=False
    )
    vendor_id = mapped_column(db.String(36), db.ForeignKey("vendor.id"), nullable=False)

    title = mapped_column(db.String(255), nullable=False)
    description = mapped_column(db.Text, nullable=True)
    contractor_name = mapped_column(db.String(255), nullable=True)

    status = mapped_column(
        db.Enum(TicketStatusEnum), nullable=False, default=TicketStatusEnum.DRAFT
    )

    scheduled_start = mapped_column(db.DateTime(timezone=True), nullable=True)
    scheduled_end = mapped_column(db.DateTime(timezone=True), nullable=True)
    completed_at = mapped_column(db.DateTime(timezone=True), nullable=True)

    approved_by = mapped_column(db.String(36), db.ForeignKey("user.id"), nullable=True)
    approved_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    rejected_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    rejection_reason = mapped_column(db.String(500), nullable=True)

    notes = mapped_column(db.Text, nullable=True)

    work_order = relationship("WorkOrder", back_populates="tickets")
    vendor = relationship("Vendor")
