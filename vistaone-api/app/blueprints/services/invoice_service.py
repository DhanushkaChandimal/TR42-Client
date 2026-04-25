from datetime import datetime, timezone
from app.models.invoice import Invoice
from app.models.line_item import LineItem
from app.blueprints.repository.invoice_repository import InvoiceRepository
from app.blueprints.repository.ticket_repository import TicketRepository
from app.blueprints.enum.enums import InvoiceStatusEnum, TicketStatusEnum
import logging

logger = logging.getLogger(__name__)

## Service adds business logic like status transitions and line item totals


class InvoiceService:

    @staticmethod
    def get_all_invoices(vendor_id=None, client_id=None, status=None):
        invoices = InvoiceRepository.get_all(
            vendor_id=vendor_id, client_id=client_id, status=status
        )
        return invoices

    @staticmethod
    def get_invoice(invoice_id):
        invoice = InvoiceRepository.get_by_id(invoice_id)
        if not invoice:
            raise ValueError("Invoice not found")
        return invoice

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
            invoice.invoice_status = InvoiceStatusEnum.DRAFT

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
    def update_invoice(invoice_id, validated_data, current_user_id):
        invoice = InvoiceRepository.get_by_id(invoice_id)
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
    def approve_invoice(invoice_id, current_user_id):
        invoice = InvoiceRepository.get_by_id(invoice_id)
        if not invoice:
            raise ValueError("Invoice not found")
        if invoice.invoice_status != InvoiceStatusEnum.SUBMITTED:
            raise ValueError("Only submitted invoices can be approved")

        invoice.invoice_status = InvoiceStatusEnum.APPROVED
        invoice.approved_at = datetime.now(timezone.utc)
        invoice.last_modified_by = current_user_id
        saved = InvoiceRepository.update(invoice)
        logger.info(f"Invoice approved: {saved.id}")
        return saved

    @staticmethod
    def reject_invoice(invoice_id, current_user_id):
        invoice = InvoiceRepository.get_by_id(invoice_id)
        if not invoice:
            raise ValueError("Invoice not found")
        if invoice.invoice_status != InvoiceStatusEnum.SUBMITTED:
            raise ValueError("Only submitted invoices can be rejected")

        invoice.invoice_status = InvoiceStatusEnum.REJECTED
        invoice.rejected_at = datetime.now(timezone.utc)
        invoice.last_modified_by = current_user_id
        saved = InvoiceRepository.update(invoice)
        logger.info(f"Invoice rejected: {saved.id}")
        return saved
