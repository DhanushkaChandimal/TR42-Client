from sqlalchemy import select, or_, cast, String, desc, asc
from app.extensions import db
from app.models.invoice import Invoice
from app.models.line_item import LineItem
from app.models.vendor import Vendor
import logging

# Whitelist of sort_by tokens the search endpoint accepts. Anything outside
# this map falls back to created_at, so the frontend can't trigger ORDER BY
# on arbitrary attributes.
INVOICE_SORT_FIELDS = {
    "created_at": Invoice.created_at,
    "invoice_date": Invoice.invoice_date,
    "due_date": Invoice.due_date,
    "total_amount": Invoice.total_amount,
    "invoice_status": Invoice.invoice_status,
    "vendor": "_vendor",
}

logger = logging.getLogger(__name__)


class InvoiceRepository:

    @staticmethod
    def get_all(vendor_id=None, client_id=None, status=None, work_order_id=None):
        query = select(Invoice)
        if vendor_id:
            query = query.where(Invoice.vendor_id == vendor_id)
        if client_id:
            query = query.where(Invoice.client_id == client_id)
        if status:
            query = query.where(Invoice.invoice_status == status)
        if work_order_id:
            query = query.where(Invoice.work_order_id == work_order_id)
        return db.session.execute(query).scalars().all()

    @staticmethod
    def get_by_id(invoice_id, client_id=None):
        query = select(Invoice).where(Invoice.id == invoice_id)
        if client_id:
            query = query.where(Invoice.client_id == client_id)
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
    def search(
        search_text=None,
        status=None,
        page=1,
        per_page=10,
        sort_by="created_at",
        order="desc",
        client_id=None,
        work_order_id=None,
    ):
        try:
            query = Invoice.query
            if client_id:
                query = query.filter(Invoice.client_id == client_id)
            if work_order_id:
                query = query.filter(Invoice.work_order_id == work_order_id)
            if status:
                query = query.filter(Invoice.invoice_status == status)
            if search_text:
                for word in search_text.lower().split():
                    pattern = f"%{word}%"
                    query = query.filter(
                        or_(
                            cast(Invoice.invoice_status, String).ilike(pattern),
                            cast(Invoice.total_amount, String).ilike(pattern),
                            Invoice.id.ilike(pattern),
                            Invoice.vendor_id.ilike(pattern),
                            Invoice.work_order_id.ilike(pattern),
                        )
                    )
            spec = INVOICE_SORT_FIELDS.get(sort_by, Invoice.created_at)
            direction = desc if order.lower() == "desc" else asc
            if spec == "_vendor":
                query = query.outerjoin(Vendor, Invoice.vendor_id == Vendor.id)
                sort_column = Vendor.company_name
            else:
                sort_column = spec
            query = query.order_by(direction(sort_column).nullslast())
            return query.paginate(page=page, per_page=per_page, error_out=False)
        except Exception as e:
            raise Exception(f"Error during invoice search: {str(e)}")

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
