from sqlalchemy import select
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
