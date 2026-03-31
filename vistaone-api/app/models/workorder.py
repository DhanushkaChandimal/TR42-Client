from . import db,Base
from sqlalchemy.orm import Mapped, mapped_column

class WorkOrder(Base):
    __tablename__ = "work_orders"

    id: Mapped[int] = mapped_column(primary_key=True)