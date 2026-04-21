from sqlalchemy import select
from app.extensions import db
from app.models.invoice import Invoice
from app.models.line_item import LineItem
import logging

logger = logging.getLogger(__name__)


class InvoiceRepository:

    @staticmethod
    def get_all(vendor_id=None, client_id=None, status=None):
        query = select(Invoice)
        if vendor_id:
            query = query.where(Invoice.vendor_id == vendor_id)
        if client_id:
            query = query.where(Invoice.client_id == client_id)
        if status:
            query = query.where(Invoice.invoice_status == status)
        return db.session.execute(query).scalars().all()

    @staticmethod
    def get_by_id(invoice_id):
        query = select(Invoice).where(Invoice.id == invoice_id)
        return db.session.execute(query).scalars().first()

    @staticmethod
    def create(invoice):
        try:
            db.session.add(invoice)
            db.session.commit()
            db.session.refresh(invoice)
            return invoice
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating invoice: {str(e)}")
            raise e

    @staticmethod
    def update(invoice):
        try:
            db.session.commit()
            db.session.refresh(invoice)
            return invoice
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating invoice: {str(e)}")
            raise e

    @staticmethod
    def create_line_item(line_item):
        try:
            db.session.add(line_item)
            db.session.commit()
            db.session.refresh(line_item)
            return line_item
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating line item: {str(e)}")
            raise e
