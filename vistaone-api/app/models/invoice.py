from sqlalchemy.orm import mapped_column, relationship
from sqlalchemy.sql import func
from app.blueprints.enum.enums import InvoiceStatusEnum
import uuid
from app.extensions import db


class Invoice(db.Model):
    __tablename__ = "invoices"

    id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    work_order_id = mapped_column(
        db.Integer, db.ForeignKey("work_orders.id"), nullable=False
    )
    vendor_id = mapped_column(
        db.String(36), db.ForeignKey("vendors.vendor_id"), nullable=False
    )
    client_id = mapped_column(
        db.String(36), db.ForeignKey("clients.client_id"), nullable=False
    )
    invoice_date = mapped_column(db.DateTime(timezone=True), nullable=False)
    due_date = mapped_column(db.DateTime(timezone=True), nullable=False)
    period_start = mapped_column(db.DateTime(timezone=True), nullable=True)
    period_end = mapped_column(db.DateTime(timezone=True), nullable=True)
    total_amount = mapped_column(db.Numeric, nullable=False, default=0.0)
    invoice_status = mapped_column(
        db.Enum(InvoiceStatusEnum), nullable=False, default=InvoiceStatusEnum.DRAFT
    )
    paid_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    approved_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    rejected_at = mapped_column(db.DateTime(timezone=True), nullable=True)
    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    ## Relationships
    work_order = relationship("WorkOrder")
    vendor = relationship("Vendor")
    client = relationship("Client")
    line_items = relationship("LineItem", back_populates="invoice")
