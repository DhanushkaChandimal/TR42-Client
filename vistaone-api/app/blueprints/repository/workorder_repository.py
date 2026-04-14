from sqlalchemy import select, or_, cast, String, desc, asc
from app.extensions import db
from app.models.workorder import WorkOrder
from app.models.address import Address
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
            db.session.rollback() # Undo any partial DB changes if error occurs
            logger.error(f"Error creating workorder: {str(e)}")
            raise e

    @staticmethod
    def get_by_work_order_id(work_order_id: str):
        return db.session.query(WorkOrder).filter_by(work_order_id=work_order_id).first()

    @staticmethod
    def get_all():
        return db.session.query(WorkOrder).all()

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


       
    #Usually we hide cancelled orders. Filter Cancelled Records in GET ALL
    @staticmethod
    def get_all_uncancelled():
        return WorkOrder.query.filter(
        WorkOrder.status != StatusEnum.CANCELLED).all()
    


    @staticmethod
    def search(search_text=None, status=None, page=1, per_page=10, sort_by="created_date", order="desc"):
        try:
            query = WorkOrder.query.outerjoin(Address)

            # Existing search logic (UNCHANGED)
            if search_text:
                words = search_text.lower().split()
                filters = []

                for word in words:
                    pattern = f"%{word}%"
                    filters.append(
                        or_(
                            WorkOrder.work_order_id.ilike(pattern),
                            WorkOrder.description.ilike(pattern),
                            cast(WorkOrder.status, String).ilike(pattern),
                            cast(WorkOrder.priority, String).ilike(pattern),
                            cast(WorkOrder.location_type, String).ilike(pattern),
                            WorkOrder.client_id.ilike(pattern),
                            WorkOrder.vendor_id.ilike(pattern),
                            WorkOrder.service_type_id.ilike(pattern),
                            cast(WorkOrder.estimated_quantity, String).ilike(pattern),
                            cast(WorkOrder.latitude, String).ilike(pattern),
                            cast(WorkOrder.longitude, String).ilike(pattern),
                            Address.city.ilike(pattern),
                            Address.state.ilike(pattern),
                            Address.street.ilike(pattern),
                            Address.zip.ilike(pattern),
                            Address.country.ilike(pattern),

                        )
                    )

                query = query.filter(*filters)

            logger.info(f"Value of status filter: {status}")  # Log the status filter value
            #  NEW: Status filter
            if status:
                query = query.filter(WorkOrder.status == status)

            #  NEW: Sorting
            sort_column = getattr(WorkOrder, sort_by, WorkOrder.created_date)

            if order.lower() == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(asc(sort_column))

            #  NEW: Pagination
            paginated = query.paginate(page=page, per_page=per_page, error_out=False)

            return paginated
        
        except Exception as e:
            raise Exception(f"Error during search: {str(e)}")