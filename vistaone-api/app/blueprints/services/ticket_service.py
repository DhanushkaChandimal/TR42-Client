from app.models.ticket import Ticket
from app.blueprints.repository.ticket_repository import TicketRepository
from app.blueprints.enum.enums import TicketStatusEnum
import logging

logger = logging.getLogger(__name__)


class TicketService:

    @staticmethod
    def get_all_tickets(work_order_id=None, vendor_id=None, status=None):
        return TicketRepository.get_all(
            work_order_id=work_order_id, vendor_id=vendor_id, status=status
        )

    @staticmethod
    def get_ticket(ticket_id):
        ticket = TicketRepository.get_by_id(ticket_id)
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
    def update_ticket(ticket_id, validated_data, current_user_id):
        ticket = TicketRepository.get_by_id(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        for key, value in validated_data.items():
            if hasattr(ticket, key):
                setattr(ticket, key, value)
        ticket.updated_by = current_user_id
        saved = TicketRepository.update(ticket)
        logger.info(f"Ticket updated: {saved.id}")
        return saved
