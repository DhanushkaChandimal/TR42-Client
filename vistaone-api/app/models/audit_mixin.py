from sqlalchemy.orm import relationship, mapped_column, declared_attr
from sqlalchemy import DateTime, String, ForeignKey, func


class AuditMixin:

    @declared_attr
    def created_at(cls):
        return mapped_column(DateTime, default=func.now(), nullable=False)

    @declared_attr
    def updated_at(cls):
        return mapped_column(
            DateTime, default=func.now(), onupdate=func.now(), nullable=False
        )

    # @declared_attr
    # def created_by(cls):
    #     return mapped_column(String(36), ForeignKey("user.id"), nullable=True)

    # @declared_attr
    # def updated_by(cls):
    #     return mapped_column(String(36), ForeignKey("user.id"), nullable=True)

    # @declared_attr
    # def created_by_user(cls):
    #     return relationship(
    #         "User",
    #         foreign_keys=[cls.created_by],
    #         uselist=False,
    #     )

    # @declared_attr
    # def updated_by_user(cls):
    #     return relationship(
    #         "User",
    #         foreign_keys=[cls.updated_by],
    #         uselist=False,
    #     )

    @declared_attr
    def created_by(cls):
        return mapped_column(String(36))

    @declared_attr
    def updated_by(cls):
        return mapped_column(String(36))
