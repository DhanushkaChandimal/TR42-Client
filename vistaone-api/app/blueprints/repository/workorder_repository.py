from sqlalchemy import or_, cast, String, desc, asc
from app.extensions import db
from app.models.workorder import WorkOrder
from app.blueprints.enum.enums import StatusEnum
import logging


logger = logging.getLogger(__name__)


class WorkOrderRepository:

    @staticmethod
    def create(workorder: WorkOrder):
        try:
            db.session.add(workorder)
            db.session.commit()
            db.session.refresh(workorder)
            return workorder
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating workorder: {str(e)}")
            raise e

    @staticmethod
    def get_by_id(work_order_id: str, client_id=None):
        query = db.session.query(WorkOrder).filter_by(id=work_order_id)
        if client_id:
            query = query.filter(WorkOrder.client_id == client_id)
        return query.first()

    @staticmethod
    def get_all(client_id=None):
        query = db.session.query(WorkOrder)
        if client_id:
            query = query.filter(WorkOrder.client_id == client_id)
        return query.all()

    @staticmethod
    def update(workorder: WorkOrder):
        try:
            db.session.add(workorder)
            db.session.commit()
            return workorder
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating workorder: {str(e)}")
            raise e

    @staticmethod
    def get_all_uncancelled():
        return WorkOrder.query.filter(WorkOrder.current_status != StatusEnum.CANCELLED).all()

    @staticmethod
    def search(
        search_text=None,
        status=None,
        page=1,
        per_page=10,
        sort_by="created_at",
        order="desc",
        client_id=None,
    ):
        try:
            query = WorkOrder.query
            if client_id:
                query = query.filter(WorkOrder.client_id == client_id)

            if search_text:
                words = search_text.lower().split()
                filters = []

                for word in words:
                    pattern = f"%{word}%"
                    filters.append(
                        or_(
                            cast(WorkOrder.work_order_code, String).ilike(pattern),
                            WorkOrder.description.ilike(pattern),
                            cast(WorkOrder.current_status, String).ilike(pattern),
                            cast(WorkOrder.priority, String).ilike(pattern),
                            cast(WorkOrder.location_type, String).ilike(pattern),
                            WorkOrder.client_id.ilike(pattern),
                            WorkOrder.assigned_vendor.ilike(pattern),
                            WorkOrder.service_type.ilike(pattern),
                            cast(WorkOrder.estimated_quantity, String).ilike(pattern),
                            cast(WorkOrder.latitude, String).ilike(pattern),
                            cast(WorkOrder.longitude, String).ilike(pattern),
                            WorkOrder.location.ilike(pattern),
                        )
                    )

                query = query.filter(*filters)

            logger.info(f"Value of status filter: {status}")
            if status:
                query = query.filter(WorkOrder.current_status == status)

            sort_column = getattr(WorkOrder, sort_by, WorkOrder.created_at)

            if order.lower() == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(asc(sort_column))

            paginated = query.paginate(page=page, per_page=per_page, error_out=False)

            return paginated

        except Exception as e:
            raise Exception(f"Error during search: {str(e)}")
