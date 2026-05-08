from app.models.ticket import Ticket
from app.blueprints.repository.ticket_repository import TicketRepository
from app.blueprints.enum.enums import TicketStatusEnum
import logging

logger = logging.getLogger(__name__)


def _bucket_counts(rows, all_keys):
    out = {k: 0 for k in all_keys}
    for status, count in rows:
        key = status.value if hasattr(status, "value") else str(status)
        out[key] = int(count)
    return out


def _format_ticket_rejection_message(ticket, rejecter, note):
    rejecter_name = _rejecter_display_name(rejecter)
    contact = _rejecter_contact_line(rejecter)
    description = (ticket.description or "").strip()

    lines = [
        "Hello,",
        "",
        "A ticket associated with you has been brought to our attention and "
        "requires review. After review on our end, the ticket has been "
        "rejected and will need follow-up before it can be approved.",
        "",
        f"Ticket reference: {ticket.id[:8]}",
    ]
    if description:
        lines.append(f"Description: {description}")
    lines.extend([
        "",
        f"Reason for rejection: {note}" if note else
        "Reason for rejection: not provided.",
        "",
        f"Please reach out to {rejecter_name} at your earliest convenience "
        "to discuss next steps.",
        f"Contact: {contact}",
        "",
        "Thank you,",
        rejecter_name,
    ])
    return "\n".join(lines)


def _rejecter_display_name(rejecter):
    if not rejecter:
        return "the client"
    full = " ".join(
        filter(None, [rejecter.first_name, rejecter.last_name])
    ).strip()
    return full or rejecter.username or rejecter.email or "the client"


def _rejecter_contact_line(rejecter):
    if not rejecter:
        return "no contact info on file"
    parts = []
    if rejecter.email:
        parts.append(rejecter.email)
    phone = getattr(rejecter, "contact_number", None)
    if phone:
        parts.append(phone)
    return " | ".join(parts) if parts else "no contact info on file"


class TicketService:

    @staticmethod
    def get_all_tickets(work_order_id=None, vendor_id=None, status=None, client_id=None):
        return TicketRepository.get_all(
            work_order_id=work_order_id, vendor_id=vendor_id, status=status, client_id=client_id
        )

    @staticmethod
    def status_counts(client_id=None, search_text=None):
        return _bucket_counts(
            TicketRepository.status_counts(client_id=client_id, search_text=search_text),
            [s.value for s in TicketStatusEnum],
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
    def search_tickets(search_text, status, page, per_page, sort_by, order, client_id=None, work_order_id=None):
        return TicketRepository.search(
            search_text=search_text,
            status=status,
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            order=order,
            client_id=client_id,
            work_order_id=work_order_id,
        )

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
        # Client approval is the final word from this app's side: the work is
        # accepted, the ticket is done, and the vendor can bill against it.
        # We move directly to COMPLETED rather than parking in an intermediate
        # APPROVED state nobody else advances.
        saved = TicketService._set_status(
            ticket_id, TicketStatusEnum.COMPLETED, current_user_id, client_id=client_id
        )
        logger.info(f"Ticket approved (set to COMPLETED): {saved.id}")
        return saved

    @staticmethod
    def reject_ticket(
        ticket_id,
        current_user_id,
        client_id=None,
        note=None,
        recipient_ids=None,
    ):
        # Pull the ticket up front so we can stamp the rejection note onto
        # ticket.notes alongside the status change. The vendor and contractor
        # apps share this database, so writing the reason here is enough for
        # them to see it without us touching their code.
        ticket = TicketRepository.get_by_id(ticket_id, client_id=client_id)
        if not ticket:
            raise ValueError("Ticket not found")
        ticket.status = TicketStatusEnum.REJECTED
        ticket.updated_by = current_user_id
        cleaned_note = note.strip() if note else ""
        if note is not None:
            ticket.notes = cleaned_note or None
        saved = TicketRepository.update(ticket)
        logger.info(f"Ticket rejected: {saved.id}")

        if recipient_ids:
            # Notification is best-effort: a chat-send failure must not roll
            # back the rejection itself.
            from app.blueprints.services.chat_service import ChatService
            from app.models.user import User
            from app.extensions import db

            rejecter = db.session.get(User, current_user_id)
            body = _format_ticket_rejection_message(saved, rejecter, cleaned_note)
            ChatService.fan_out_message(current_user_id, recipient_ids, body)

        return saved

    @staticmethod
    def set_pending_ticket(ticket_id, current_user_id, client_id=None):
        saved = TicketService._set_status(
            ticket_id, TicketStatusEnum.PENDING_APPROVAL, current_user_id, client_id=client_id
        )
        logger.info(f"Ticket set to pending approval: {saved.id}")
        return saved
