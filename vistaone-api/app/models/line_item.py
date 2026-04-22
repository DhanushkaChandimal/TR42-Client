from sqlalchemy.orm import mapped_column, relationship
from sqlalchemy.sql import func
import uuid
from app.extensions import db


class LineItem(db.Model):
    __tablename__ = "line_items"

    id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    invoice_id = mapped_column(
        db.String(36), db.ForeignKey("invoices.id"), nullable=False
    )
    quantity = mapped_column(db.Integer, nullable=False)
    rate = mapped_column(db.Numeric, nullable=False)
    amount = mapped_column(db.Numeric, nullable=False)
    description = mapped_column(db.Text, nullable=True)
    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    ## Relationships
    invoice = relationship("Invoice", back_populates="line_items")
