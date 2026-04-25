from datetime import datetime, timezone
from app.models.ticket import Ticket
from app.models.vendor import Vendor
from app.blueprints.repository.ticket_repository import TicketRepository
from app.blueprints.enum.enums import TicketStatusEnum
from app.utils.notifications import send_vendor_notification
from app.extensions import db
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
            ticket.status = TicketStatusEnum.DRAFT
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

    @staticmethod
    def approve_ticket(ticket_id, current_user_id):
        ticket = TicketRepository.get_by_id(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        if ticket.status == TicketStatusEnum.APPROVED:
            raise ValueError("Ticket is already approved")

        ticket.status = TicketStatusEnum.APPROVED
        ticket.approved_by = current_user_id
        ticket.approved_at = datetime.now(timezone.utc)
        ticket.rejected_at = None
        ticket.rejection_reason = None
        ticket.updated_by = current_user_id
        saved = TicketRepository.update(ticket)
        logger.info(f"Ticket approved: {saved.id}")

        vendor = db.session.get(Vendor, saved.vendor_id)
        if vendor and vendor.company_email:
            send_vendor_notification(
                to_email=vendor.company_email,
                subject=f"Ticket #{saved.ticket_number} approved",
                body=(
                    f"Ticket '{saved.title}' on work order {saved.work_order_id} "
                    f"has been approved by the client."
                ),
            )
        return saved

    @staticmethod
    def reject_ticket(ticket_id, current_user_id, rejection_reason):
        ticket = TicketRepository.get_by_id(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        if not rejection_reason or not rejection_reason.strip():
            raise ValueError("Rejection reason is required")

        ticket.status = TicketStatusEnum.REJECTED
        ticket.rejection_reason = rejection_reason.strip()
        ticket.rejected_at = datetime.now(timezone.utc)
        ticket.approved_by = None
        ticket.approved_at = None
        ticket.updated_by = current_user_id
        saved = TicketRepository.update(ticket)
        logger.info(f"Ticket rejected: {saved.id}")

        vendor = db.session.get(Vendor, saved.vendor_id)
        if vendor and vendor.company_email:
            send_vendor_notification(
                to_email=vendor.company_email,
                subject=f"Ticket #{saved.ticket_number} rejected",
                body=(
                    f"Ticket '{saved.title}' on work order {saved.work_order_id} "
                    f"has been rejected by the client.\n\n"
                    f"Reason: {saved.rejection_reason}"
                ),
            )
        return saved

    @staticmethod
    def all_tickets_approved_for_work_order(work_order_id):
        tickets = TicketRepository.get_by_work_order(work_order_id)
        if not tickets:
            return False
        return all(t.status == TicketStatusEnum.APPROVED for t in tickets)
