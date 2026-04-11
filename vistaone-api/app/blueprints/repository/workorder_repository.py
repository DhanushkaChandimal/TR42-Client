from sqlalchemy import select
from app.extensions import db
from app.models import WorkOrder


class WorkOrderRepository:

    @staticmethod
    def create(workorder: WorkOrder):
        db.session.add(workorder)
        db.session.commit()
        db.session.refresh(workorder)
        return workorder

    @staticmethod
    def get_by_id(work_order_id: str):
        return WorkOrder.query.get(work_order_id)

    @staticmethod
    def get_all():
        return WorkOrder.query.all()

    @staticmethod
    def update():
        db.session.commit()

       
    #Usually we hide cancelled orders. Filter Cancelled Records in GET ALL
    # @staticmethod
    # def get_all():
    #     return WorkOrder.query.filter(
    #     WorkOrder.status != StatusEnum.CANCELLED).all()