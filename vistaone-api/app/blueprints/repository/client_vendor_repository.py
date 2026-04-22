from sqlalchemy import select
from app.extensions import db
from app.models.client_vendor import ClientVendor
import logging

logger = logging.getLogger(__name__)


class ClientVendorRepository:

    @staticmethod
    def get_by_client(client_id):
        query = select(ClientVendor).where(ClientVendor.client_id == client_id)
        return db.session.execute(query).scalars().all()

    @staticmethod
    def get_by_client_and_vendor(client_id, vendor_id):
        query = select(ClientVendor).where(
            ClientVendor.client_id == client_id,
            ClientVendor.vendor_id == vendor_id,
        )
        return db.session.execute(query).scalars().first()

    @staticmethod
    def create(client_vendor):
        try:
            db.session.add(client_vendor)
            db.session.commit()
            db.session.refresh(client_vendor)
            return client_vendor
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error adding vendor to favorites: {str(e)}")
            raise e

    @staticmethod
    def delete(client_vendor):
        try:
            db.session.delete(client_vendor)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error removing vendor from favorites: {str(e)}")
            raise e
