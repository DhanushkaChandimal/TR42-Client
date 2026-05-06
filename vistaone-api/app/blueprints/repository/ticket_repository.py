from sqlalchemy import select, or_, cast, String, desc, asc
from sqlalchemy.orm import joinedload, selectinload
from app.extensions import db
from app.models.ticket import Ticket
from app.models.invoice import Invoice
from app.models.workorder import WorkOrder
import logging

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
            if client_id:
                query = query.join(WorkOrder, Ticket.work_order_id == WorkOrder.id).filter(
                    WorkOrder.client_id == client_id
                )
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
            sort_column = getattr(Ticket, sort_by, Ticket.created_at)
            query = query.order_by(desc(sort_column) if order.lower() == "desc" else asc(sort_column))
            return query.paginate(page=page, per_page=per_page, error_out=False)
        except Exception as e:
            raise Exception(f"Error during ticket search: {str(e)}")
