from datetime import datetime
import uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.extensions import db
from sqlalchemy.sql import func




class Address(db.Model):
    __tablename__ = "address"

    address_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    street = mapped_column(db.String(255))
    city = mapped_column(db.String(100))
    state = mapped_column(db.String(20))
    zip = mapped_column(db.String(10))
    country = mapped_column(db.String(2))

    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())

  
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)