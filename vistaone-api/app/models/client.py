from sqlalchemy.orm import mapped_column, relationship
from sqlalchemy.sql import func
import uuid
from app.extensions import db


class Client(db.Model):
    __tablename__ = "clients"

    client_id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name = mapped_column(db.String(255), nullable=False)
    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    wells = relationship("Well", back_populates="client")
    workorders = relationship("WorkOrder", back_populates="client")

    address_id = mapped_column(db.String(36), db.ForeignKey("address.id"))
    address = relationship("Address")
