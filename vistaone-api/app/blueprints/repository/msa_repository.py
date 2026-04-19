from sqlalchemy import select
from app.extensions import db
from app.models.msa import Msa
from app.models.vendor import Vendor
from app.models.user import User
import logging

logger = logging.getLogger(__name__)


class MsaRepository:

    @staticmethod
    def get_all(vendor_id=None, status=None):
        query = select(Msa)
        if vendor_id:
            query = query.where(Msa.vendor_id == vendor_id)
        if status:
            query = query.where(Msa.status == status)
        return db.session.execute(query).scalars().all()

    @staticmethod
    def get_by_id(msa_id):
        query = select(Msa).where(Msa.id == msa_id)
        return db.session.execute(query).scalars().first()

    @staticmethod
    def create(msa):
        try:
            db.session.add(msa)
            db.session.commit()
            db.session.refresh(msa)
            return msa
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating msa: {str(e)}")
            raise e

    @staticmethod
    def update(msa):
        try:
            db.session.commit()
            db.session.refresh(msa)
            return msa
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating msa: {str(e)}")
            raise e

    @staticmethod
    def get_vendor_name(vendor_id):
        query = select(Vendor.company_name).where(Vendor.vendor_id == vendor_id)
        return db.session.execute(query).scalars().first()

    @staticmethod
    def get_uploader_name(user_id):
        if not user_id:
            return None
        try:
            query = select(User).where(User.id == user_id)
            user = db.session.execute(query).scalars().first()
            if user:
                return f"{user.first_name} {user.last_name}"
            return None
        except (ValueError, TypeError):
            return None
