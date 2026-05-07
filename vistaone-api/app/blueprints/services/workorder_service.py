from datetime import datetime
from sqlalchemy import func
from app.extensions import db
from app.models import WorkOrder
from app.blueprints.repository.workorder_repository import WorkOrderRepository
import logging
from app.blueprints.enum.enums import LocationTypeEnum, StatusEnum, FrequencyEnum

logger = logging.getLogger(__name__)


def _bucket_counts(rows, all_keys):
    out = {k: 0 for k in all_keys}
    for status, count in rows:
        key = status.value if hasattr(status, "value") else str(status)
        out[key] = int(count)
    return out


class WorkOrderService:

    @staticmethod
    def status_counts(client_id=None, search_text=None):
        return _bucket_counts(
            WorkOrderRepository.status_counts(client_id=client_id, search_text=search_text),
            [s.value for s in StatusEnum],
        )

    @staticmethod
    def create_workorder(validated_workorder_data, current_user_id):
        try:
            work_order = WorkOrder(**validated_workorder_data)

            if not work_order.is_recurring:
                work_order.recurrence_type = FrequencyEnum.ONE_TIME.value

            work_order.created_by = current_user_id
            work_order.updated_by = current_user_id

            # Allocate next sequential work_order_code so the row is visible
            # in the list (UI keys on this column) and matches seeded format.
            if work_order.work_order_code is None:
                next_code = db.session.query(func.max(WorkOrder.work_order_code)).scalar()
                work_order.work_order_code = (next_code or 99999) + 1

            location_type = validated_workorder_data.get("location_type")
            logger.info(f"Creating workorder with location type: {location_type}")

            if location_type == LocationTypeEnum.ADDRESS:
                work_order.latitude = None
                work_order.longitude = None
                work_order.well_id = None
                if not validated_workorder_data.get("location"):
                    raise Exception("location is required for ADDRESS location_type")

            elif location_type == LocationTypeEnum.GPS:
                work_order.well_id = None
                work_order.location = None
                if not validated_workorder_data.get(
                    "latitude"
                ) or not validated_workorder_data.get("longitude"):
                    raise Exception("latitude & longitude required")
                work_order.latitude = validated_workorder_data.get("latitude")
                work_order.longitude = validated_workorder_data.get("longitude")

            elif location_type == LocationTypeEnum.WELL:
                work_order.latitude = None
                work_order.longitude = None
                work_order.location = None
                if not validated_workorder_data.get("well_id"):
                    raise Exception("well_id is required for WELL location")
                work_order.well_id = validated_workorder_data.get("well_id")

            return WorkOrderRepository.create(work_order)

        except Exception as e:
            logger.error(f"Error creating workorder: {str(e)}")
            raise e

    @staticmethod
    def get_workorder(work_order_id: str, current_user_id, client_id=None):
        workorder = WorkOrderRepository.get_by_id(work_order_id, client_id=client_id)
        if not workorder:
            raise ValueError("WorkOrder not found")
        return workorder

    @staticmethod
    def get_all_workorders(client_id=None):
        return WorkOrderRepository.get_all(client_id=client_id)

    @staticmethod
    def update_workorder(current_user_id, work_order_id: str, data, client_id=None):
        try:
            workorder = WorkOrderRepository.get_by_id(work_order_id, client_id=client_id)
            if not workorder:
                raise Exception("WorkOrder not found")

            if not current_user_id:
                raise Exception("current_user_id not provided!")

            location_type = data.get("location_type") or workorder.location_type

            ALLOWED_FIELDS = {
                "current_status",
                "well_id",
                "assigned_vendor",
                "service_type",
                "description",
                "priority",
                "is_recurring",
                "recurrence_type",
                "estimated_start_date",
                "estimated_end_date",
                "latitude",
                "longitude",
                "location",
                "comments",
                "client_id",
                "units",
                "estimated_quantity",
                "location_type",
            }

            for key, value in data.items():
                if key in ALLOWED_FIELDS:
                    setattr(workorder, key, value)

            if "is_recurring" in data and not workorder.is_recurring:
                workorder.recurrence_type = FrequencyEnum.ONE_TIME.value

            if location_type == LocationTypeEnum.ADDRESS:
                workorder.latitude = None
                workorder.longitude = None
                workorder.well_id = None
                if not workorder.location and not data.get("location"):
                    raise Exception("location required for ADDRESS")

            elif location_type == LocationTypeEnum.GPS:
                workorder.well_id = None
                workorder.location = None
                lat = data.get("latitude")
                lng = data.get("longitude")
                if lat is None or lng is None:
                    raise Exception("latitude & longitude required")
                workorder.latitude = lat
                workorder.longitude = lng

            elif location_type == LocationTypeEnum.WELL:
                workorder.latitude = None
                workorder.longitude = None
                workorder.location = None
                if not data.get("well_id"):
                    raise Exception("well_id is required for WELL location")
                workorder.well_id = data.get("well_id")

            workorder.updated_by = current_user_id
            WorkOrderRepository.update(workorder)
            return workorder

        except Exception as e:
            logger.error(f"Error updating workorder: {str(e)}")
            raise e

    @staticmethod
    def cancel_workorder(work_order_id, cancellation_reason, current_user_id, client_id=None):
        try:
            logger.info(f"Attempting to cancel workorder with ID: {work_order_id}")
            workorder = WorkOrderRepository.get_by_id(work_order_id, client_id=client_id)
        except Exception as e:
            logger.error(f"Error retrieving workorder: {str(e)}")
            raise e

        if not workorder:
            raise ValueError("WorkOrder not found")

        blocked_statuses = [
            StatusEnum.IN_PROGRESS,
            StatusEnum.COMPLETED,
            StatusEnum.CLOSED,
            StatusEnum.CANCELLED,
        ]

        if workorder.current_status in blocked_statuses:
            raise Exception(
                f"WorkOrder cannot be cancelled because current status is {workorder.current_status.value}"
            )

        workorder.current_status = StatusEnum.CANCELLED
        workorder.updated_by = current_user_id
        workorder.cancelled_by = current_user_id
        workorder.cancelled_at = datetime.now()
        workorder.cancellation_reason = cancellation_reason
        WorkOrderRepository.update(workorder)

        return True

    @staticmethod
    def search_workorders(search_text, status, page, per_page, sort_by, order, client_id=None):
        return WorkOrderRepository.search(
            search_text=search_text,
            status=status,
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            order=order,
            client_id=client_id,
        )
