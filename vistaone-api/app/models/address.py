import uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.extensions import db
from app.models.audit_mixin import AuditMixin


class Address(db.Model, AuditMixin):
    __tablename__ = "address"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    street: Mapped[str] = mapped_column(db.String(255), nullable=False)
    city: Mapped[str] = mapped_column(db.String(100), nullable=False)
    state: Mapped[str] = mapped_column(db.String(50))
    zip: Mapped[str] = mapped_column(db.String(20), nullable=False)
    country: Mapped[str] = mapped_column(db.String(100), nullable=False)
