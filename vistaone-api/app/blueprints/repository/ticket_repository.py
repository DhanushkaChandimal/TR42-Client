from sqlalchemy import select, or_, cast, String, desc, asc
from sqlalchemy.orm import joinedload, selectinload
from app.extensions import db
from app.models.ticket import Ticket
from app.models.invoice import Invoice
from app.models.workorder import WorkOrder
from app.models.vendor import Vendor
import logging

# Whitelist of sort_by values the search endpoint accepts. The keys are the
# tokens the frontend sends; values are either a Ticket column or a marker
# string that triggers a join below. Anything outside this map falls back to
# created_at.
TICKET_SORT_FIELDS = {
    "created_at": Ticket.created_at,
    "due_date": Ticket.due_date,
    "description": Ticket.description,
    "assigned_contractor": Ticket.assigned_contractor,
    "priority": Ticket.priority,
    "status": Ticket.status,
    "vendor": "_vendor",
    "work_order": "_work_order",
    "cost": "_cost",
}

logger = logging.getLogger(__name__)


class TicketRepository:

    @staticmethod
    def get_all(work_order_id=None, vendor_id=None, status=None, client_id=None):
        query = select(Ticket).options(
            joinedload(Ticket.vendor),
            joinedload(Ticket.invoice),
            joinedload(Ticket.work_order),
        )
        if work_order_id:
            query = query.where(Ticket.work_order_id == work_order_id)
        if vendor_id:
            query = query.where(Ticket.vendor_id == vendor_id)
        if status:
            query = query.where(Ticket.status == status)
        if client_id:
            # Tickets do not carry client_id directly — scope through the parent
            # work order so a client can only see tickets on their own WOs.
            query = query.join(WorkOrder, Ticket.work_order_id == WorkOrder.id).where(
                WorkOrder.client_id == client_id
            )
        query = query.order_by(Ticket.created_at.desc())
        return db.session.execute(query).scalars().all()

    @staticmethod
    def get_by_id(ticket_id, client_id=None):
        query = (
            select(Ticket)
            .where(Ticket.id == ticket_id)
            .options(
                joinedload(Ticket.vendor),
                joinedload(Ticket.service),
                joinedload(Ticket.work_order),
                joinedload(Ticket.invoice).selectinload(Invoice.line_items),
            )
        )
        if client_id:
            query = query.join(WorkOrder, Ticket.work_order_id == WorkOrder.id).where(
                WorkOrder.client_id == client_id
            )
        return db.session.execute(query).scalars().first()

    @staticmethod
    def get_by_work_order(work_order_id):
        query = select(Ticket).where(Ticket.work_order_id == work_order_id)
        return db.session.execute(query).scalars().all()

    @staticmethod
    def create(ticket):
        try:
            db.session.add(ticket)
            db.session.commit()
            db.session.refresh(ticket)
            return ticket
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating ticket: {str(e)}")
            raise e

    @staticmethod
    def update(ticket):
        try:
            db.session.commit()
            db.session.refresh(ticket)
            return ticket
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating ticket: {str(e)}")
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
            query = Ticket.query.options(
                joinedload(Ticket.vendor),
                joinedload(Ticket.work_order),
            )

            spec = TICKET_SORT_FIELDS.get(sort_by, Ticket.created_at)

            # Join WorkOrder once, whether for tenant scope or for sorting,
            # so we don't double-join (which SQLAlchemy treats as ambiguous).
            if client_id or spec == "_work_order":
                query = query.outerjoin(WorkOrder, Ticket.work_order_id == WorkOrder.id)
            if client_id:
                query = query.filter(WorkOrder.client_id == client_id)

            if work_order_id:
                query = query.filter(Ticket.work_order_id == work_order_id)
            if status:
                query = query.filter(Ticket.status == status)
            if search_text:
                for word in search_text.lower().split():
                    pattern = f"%{word}%"
                    query = query.filter(
                        or_(
                            Ticket.description.ilike(pattern),
                            cast(Ticket.status, String).ilike(pattern),
                            cast(Ticket.priority, String).ilike(pattern),
                            Ticket.assigned_contractor.ilike(pattern),
                        )
                    )

            direction = desc if order.lower() == "desc" else asc
            if spec == "_vendor":
                query = query.outerjoin(Vendor, Ticket.vendor_id == Vendor.id)
                sort_column = Vendor.company_name
            elif spec == "_work_order":
                sort_column = WorkOrder.work_order_code
            elif spec == "_cost":
                query = query.outerjoin(Invoice, Ticket.invoice_id == Invoice.id)
                sort_column = Invoice.total_amount
            else:
                sort_column = spec
            # NULLS LAST so empty values (no vendor, no invoice, no WO code)
            # don't dominate the top of an ascending sort.
            query = query.order_by(direction(sort_column).nullslast())
            return query.paginate(page=page, per_page=per_page, error_out=False)
        except Exception as e:
            raise Exception(f"Error during ticket search: {str(e)}")
