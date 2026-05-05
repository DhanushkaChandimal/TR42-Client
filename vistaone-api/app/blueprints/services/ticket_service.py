from app.models.ticket import Ticket
from app.blueprints.repository.ticket_repository import TicketRepository
from app.blueprints.enum.enums import TicketStatusEnum
import logging

logger = logging.getLogger(__name__)


class TicketService:

    @staticmethod
    def get_all_tickets(work_order_id=None, vendor_id=None, status=None, client_id=None):
        return TicketRepository.get_all(
            work_order_id=work_order_id, vendor_id=vendor_id, status=status, client_id=client_id
        )

    @staticmethod
    def get_ticket(ticket_id, client_id=None):
        ticket = TicketRepository.get_by_id(ticket_id, client_id=client_id)
        if not ticket:
            raise ValueError("Ticket not found")
        return ticket

    @staticmethod
    def get_tickets_by_work_order(work_order_id):
        return TicketRepository.get_by_work_order(work_order_id)

    @staticmethod
    def create_ticket(validated_data, current_user_id):
        ticket = Ticket(**validated_data)
        ticket.created_by = current_user_id
        if not ticket.status:
            ticket.status = TicketStatusEnum.UNASSIGNED
        saved = TicketRepository.create(ticket)
        logger.info(f"Ticket created: {saved.id}")
        return saved

    @staticmethod
    def update_ticket(ticket_id, validated_data, current_user_id, client_id=None):
        ticket = TicketRepository.get_by_id(ticket_id, client_id=client_id)
        if not ticket:
            raise ValueError("Ticket not found")
        for key, value in validated_data.items():
            if hasattr(ticket, key):
                setattr(ticket, key, value)
        ticket.updated_by = current_user_id
        saved = TicketRepository.update(ticket)
        logger.info(f"Ticket updated: {saved.id}")
        return saved

    @staticmethod
    def _set_status(ticket_id, new_status, current_user_id, client_id=None):
        ticket = TicketRepository.get_by_id(ticket_id, client_id=client_id)
        if not ticket:
            raise ValueError("Ticket not found")
        ticket.status = new_status
        ticket.updated_by = current_user_id
        saved = TicketRepository.update(ticket)
        return saved

    @staticmethod
    def approve_ticket(ticket_id, current_user_id, client_id=None):
        saved = TicketService._set_status(
            ticket_id, TicketStatusEnum.APPROVED, current_user_id, client_id=client_id
        )
        logger.info(f"Ticket approved: {saved.id}")
        return saved

    @staticmethod
    def reject_ticket(ticket_id, current_user_id, client_id=None):
        saved = TicketService._set_status(
            ticket_id, TicketStatusEnum.REJECTED, current_user_id, client_id=client_id
        )
        logger.info(f"Ticket rejected: {saved.id}")
        return saved

    @staticmethod
    def set_pending_ticket(ticket_id, current_user_id, client_id=None):
        saved = TicketService._set_status(
            ticket_id, TicketStatusEnum.PENDING_APPROVAL, current_user_id, client_id=client_id
        )
        logger.info(f"Ticket set to pending approval: {saved.id}")
        return saved
