from sqlalchemy.orm import mapped_column, declared_attr
from sqlalchemy import DateTime, String, func


class AuditMixin:

    @declared_attr
    def created_at(cls):
        return mapped_column(DateTime, default=func.now(), nullable=False)

    @declared_attr
    def updated_at(cls):
        return mapped_column(
            DateTime, default=func.now(), onupdate=func.now(), nullable=False
        )

    @declared_attr
    def created_by(cls):
        return mapped_column(String(36), nullable=True)

    @declared_attr
    def updated_by(cls):
        return mapped_column(String(36), nullable=True)
