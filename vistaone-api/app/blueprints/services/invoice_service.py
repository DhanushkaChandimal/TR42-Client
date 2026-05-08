from datetime import datetime, timezone
from app.models.invoice import Invoice
from app.models.line_item import LineItem
from app.blueprints.repository.invoice_repository import InvoiceRepository
from app.blueprints.repository.ticket_repository import TicketRepository
from app.blueprints.enum.enums import InvoiceStatusEnum, TicketStatusEnum
import logging

logger = logging.getLogger(__name__)


def _bucket_counts(rows, all_keys):
    """Turn (status, count) rows into a dict that includes every enum value
    pre-populated to 0 so the frontend can render a fixed set of cards."""
    out = {k: 0 for k in all_keys}
    for status, count in rows:
        key = status.value if hasattr(status, "value") else str(status)
        out[key] = int(count)
    return out


## Service adds business logic like status transitions and line item totals


def _format_invoice_rejection_message(invoice, rejecter, note):
    amount = ""
    if invoice.total_amount is not None:
        amount = f" for ${float(invoice.total_amount):,.2f}"
    label = f"Invoice {invoice.id[:8]}{amount}"
    rejecter_name = (
        " ".join(filter(None, [rejecter.first_name, rejecter.last_name])).strip()
        or rejecter.username
        or rejecter.email
        if rejecter
        else "the client"
    )
    contact_bits = []
    if rejecter and rejecter.email:
        contact_bits.append(rejecter.email)
    if rejecter and getattr(rejecter, "contact_number", None):
        contact_bits.append(rejecter.contact_number)
    contact = " / ".join(contact_bits) if contact_bits else "no contact info on file"

    lines = [
        f"{label} has been rejected.",
        f"Reason: {note}" if note else "No reason was provided.",
        f"Please contact {rejecter_name} ({contact}) for next steps.",
    ]
    return "\n".join(lines)


class InvoiceService:

    @staticmethod
    def get_all_invoices(vendor_id=None, client_id=None, status=None, work_order_id=None):
        invoices = InvoiceRepository.get_all(
            vendor_id=vendor_id, client_id=client_id, status=status, work_order_id=work_order_id
        )
        return invoices

    @staticmethod
    def get_invoice(invoice_id, client_id=None):
        invoice = InvoiceRepository.get_by_id(invoice_id, client_id=client_id)
        if not invoice:
            raise ValueError("Invoice not found")
        return invoice

    @staticmethod
    def status_counts(client_id=None, search_text=None):
        return _bucket_counts(
            InvoiceRepository.status_counts(client_id=client_id, search_text=search_text),
            [s.value for s in InvoiceStatusEnum],
        )

    @staticmethod
    def search_invoices(search_text, status, page, per_page, sort_by, order, client_id=None, work_order_id=None):
        return InvoiceRepository.search(
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
    def create_invoice(validated_data, current_user_id):
        try:
            line_items_data = validated_data.pop("line_items", [])

            work_order_id = validated_data.get("work_order_id")
            if work_order_id:
                tickets = TicketRepository.get_by_work_order(work_order_id)
                if not tickets:
                    raise ValueError(
                        "Cannot create invoice: work order has no tickets"
                    )
                unapproved = [
                    t for t in tickets if t.status != TicketStatusEnum.APPROVED
                ]
                if unapproved:
                    raise ValueError(
                        f"Cannot create invoice: {len(unapproved)} ticket(s) "
                        f"on this work order are not yet approved"
                    )

            invoice = Invoice(**validated_data)
            invoice.created_by = current_user_id
            invoice.invoice_status = InvoiceStatusEnum.SUBMITTED

            saved = InvoiceRepository.create(invoice)

            for item_data in line_items_data:
                line_item = LineItem(
                    invoice_id=saved.id,
                    quantity=item_data["quantity"],
                    rate=item_data["rate"],
                    amount=item_data["amount"],
                    description=item_data.get("description"),
                    created_by=current_user_id,
                )
                InvoiceRepository.create_line_item(line_item)

            logger.info(f"Invoice created: {saved.id}")
            return saved
        except Exception as e:
            logger.error(f"Error creating invoice: {str(e)}")
            raise e

    @staticmethod
    def update_invoice(invoice_id, validated_data, current_user_id, client_id=None):
        invoice = InvoiceRepository.get_by_id(invoice_id, client_id=client_id)
        if not invoice:
            raise ValueError("Invoice not found")

        for key, value in validated_data.items():
            if hasattr(invoice, key):
                setattr(invoice, key, value)

        invoice.last_modified_by = current_user_id
        saved = InvoiceRepository.update(invoice)
        logger.info(f"Invoice updated: {saved.id}")
        return saved

    @staticmethod
    def approve_invoice(invoice_id, current_user_id, client_id=None):
        invoice = InvoiceRepository.get_by_id(invoice_id, client_id=client_id)
        if not invoice:
            raise ValueError("Invoice not found")

        invoice.invoice_status = InvoiceStatusEnum.APPROVED
        invoice.approved_at = datetime.now(timezone.utc)
        invoice.last_modified_by = current_user_id
        saved = InvoiceRepository.update(invoice)
        logger.info(f"Invoice approved: {saved.id}")
        return saved

    @staticmethod
    def reject_invoice(
        invoice_id,
        current_user_id,
        client_id=None,
        note=None,
        recipient_ids=None,
    ):
        invoice = InvoiceRepository.get_by_id(invoice_id, client_id=client_id)
        if not invoice:
            raise ValueError("Invoice not found")

        invoice.invoice_status = InvoiceStatusEnum.REJECTED
        invoice.rejected_at = datetime.now(timezone.utc)
        invoice.last_modified_by = current_user_id
        saved = InvoiceRepository.update(invoice)
        logger.info(f"Invoice rejected: {saved.id}")

        if recipient_ids:
            from app.blueprints.services.chat_service import ChatService
            from app.models.user import User
            from app.extensions import db

            cleaned = (note or "").strip()
            rejecter = db.session.get(User, current_user_id)
            body = _format_invoice_rejection_message(saved, rejecter, cleaned)
            ChatService.fan_out_message(current_user_id, recipient_ids, body)

        return saved

    @staticmethod
    def set_pending_invoice(invoice_id, current_user_id, client_id=None):
        invoice = InvoiceRepository.get_by_id(invoice_id, client_id=client_id)
        if not invoice:
            raise ValueError("Invoice not found")

        invoice.invoice_status = InvoiceStatusEnum.SUBMITTED
        invoice.last_modified_by = current_user_id
        saved = InvoiceRepository.update(invoice)
        logger.info(f"Invoice reset to submitted: {saved.id}")
        return saved
