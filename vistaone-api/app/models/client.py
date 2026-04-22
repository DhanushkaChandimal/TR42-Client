from sqlalchemy.orm import mapped_column, Mapped
import uuid
from app.extensions import db
from app.models.audit_mixin import AuditMixin


class Client(db.Model, AuditMixin):
    __tablename__ = "client"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    client_name: Mapped[str] = mapped_column(db.String(255), nullable=False)
    client_code: Mapped[str] = mapped_column(
        db.String(255), nullable=False, unique=True
    )
    primary_contact_name: Mapped[str] = mapped_column(db.String(80), nullable=False)
    company_email: Mapped[str] = mapped_column(db.String(100), nullable=False)
    company_contact_number: Mapped[str] = mapped_column(db.String(30), nullable=False)
    company_web_address: Mapped[str] = mapped_column(db.String(100), nullable=True)

    address_id: Mapped[str] = mapped_column(
        db.String(36), db.ForeignKey("address.id"), unique=True
    )
    address = db.relationship("Address")

    users = db.relationship(
        "User", foreign_keys="User.client_id", back_populates="client"
    )
    wells = db.relationship("Well", back_populates="client")
    workorders = db.relationship("WorkOrder", back_populates="client")
