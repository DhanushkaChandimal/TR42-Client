from uuid import UUID
from app.models.well import Well
from app.models.user import User
from app.blueprints.repository.well_repository import WellRepository
import logging

logger = logging.getLogger(__name__)


class WellService:
    @staticmethod
    def search_wells(search_text, status, page, per_page, sort_by, order, client_id=None):
        return WellRepository.search(
            search_text=search_text,
            status=status,
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            order=order,
            client_id=client_id,
        )

    @staticmethod
    def create_well(well: Well, current_user_id: str):
        try:
            user = User.query.get(current_user_id)
            if not user or not user.client_id:
                raise ValueError("Authenticated user has no associated client")
            well.client_id = user.client_id
            well.created_by = current_user_id
            well.updated_by = current_user_id
            return WellRepository.create(well)
        except Exception as e:
            logger.error(f"Error creating well: {str(e)}")
            raise e

    @staticmethod
    def get_well(well_id: UUID | str, client_id=None):
        well = WellRepository.get_by_id(well_id, client_id=client_id)
        if not well:
            raise ValueError("Well not found")
        return well

    @staticmethod
    def get_all_wells(client_id=None):
        return WellRepository.get_all(client_id=client_id)

    @staticmethod
    def update_well(well: Well, current_user_id: str):
        try:
            well.updated_by = current_user_id
            return WellRepository.update(well)
        except Exception as e:
            logger.error(f"Error updating well: {str(e)}")
            raise e

    @staticmethod
    def delete_well(well_id: UUID | str, client_id=None):
        try:
            result = WellRepository.delete(well_id, client_id=client_id)
            if not result:
                raise ValueError("Well not found")
            return True
        except Exception as e:
            logger.error(f"Error deleting well: {str(e)}")
            raise e
