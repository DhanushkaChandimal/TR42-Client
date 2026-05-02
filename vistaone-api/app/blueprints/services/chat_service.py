"""WorkOrder messenger service.

Discovers eligible recipients on a work order, creates 1-on-1 chats scoped
to that WO, and orchestrates message + attachment persistence.

Recipient discovery rules (v1):
- Vendor side: every auth_user linked to the WO's vendor via `vendor_user`.
  If `vendor_user` rows are missing for the vendor (early adoption), falls
  back to none — vendor users must be enrolled.
- Contractor side: best-effort name match against
  `ticket.assigned_contractor` text across the WO's tickets. Matches on
  case-insensitive `concat(first_name, ' ', last_name)` from auth_user. Names
  that don't match any user are silently dropped (no recipient available).

The contractor name-match is brittle. The proper fix is an
`assigned_contractor_id` FK on ticket; that's a separate change.
"""
import logging
from sqlalchemy import select, func, and_, or_
from app.extensions import db
from app.models.chat import Chat
from app.models.message import Message
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.models.workorder import WorkOrder
from app.models.ticket import Ticket
from app.models.vendor import Vendor
from app.models.msa import Msa
from app.models.invoice import Invoice
from app.blueprints.repository.chat_repository import (
    ChatRepository,
    MessageRepository,
    FileAttachmentRepository,
)

logger = logging.getLogger(__name__)


MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024  # 10 MB


class ChatService:

    @staticmethod
    def get_workorder(wo_id):
        return db.session.get(WorkOrder, wo_id)

    @staticmethod
    def get_recipients(wo_id, current_user_id):
        """Return [{id, name, role}] for everyone the current user can message
        on this WO. Excludes the current user."""
        wo = ChatService.get_workorder(wo_id)
        if not wo:
            return None

        recipients = {}

        # Vendor users
        if wo.vendor_id:
            vendor_users = (
                db.session.execute(
                    select(User, VendorUser.vendor_user_role)
                    .join(VendorUser, VendorUser.user_id == User.id)
                    .where(VendorUser.vendor_id == wo.vendor_id)
                )
                .all()
            )
            for user, role in vendor_users:
                if user.id == current_user_id:
                    continue
                recipients[user.id] = {
                    "id": user.id,
                    "name": _full_name(user),
                    "role": f"vendor:{role or 'member'}",
                }

        # Contractor users via best-effort name match
        ticket_names = (
            db.session.execute(
                select(Ticket.assigned_contractor)
                .where(
                    and_(
                        Ticket.work_order_id == wo_id,
                        Ticket.assigned_contractor.isnot(None),
                    )
                )
                .distinct()
            )
            .scalars()
            .all()
        )
        normalized_names = {n.strip().lower() for n in ticket_names if n and n.strip()}
        if normalized_names:
            users = (
                db.session.execute(
                    select(User).where(
                        func.lower(
                            func.concat(User.first_name, " ", User.last_name)
                        ).in_(normalized_names)
                    )
                )
                .scalars()
                .all()
            )
            for user in users:
                if user.id == current_user_id:
                    continue
                recipients.setdefault(
                    user.id,
                    {
                        "id": user.id,
                        "name": _full_name(user),
                        "role": "contractor",
                    },
                )

        return list(recipients.values())

    @staticmethod
    def can_user_access_chat(chat, user_id):
        return user_id in (chat.user_one_id, chat.user_two_id)

    @staticmethod
    def list_workorder_tree(user_id):
        """Return WOs the user can see, each with vendor + contractor groupings
        and existing chat ids per recipient. Drives the per-WO accordion in
        the Messages page.
        """
        wos = db.session.execute(select(WorkOrder)).scalars().all()
        if not wos:
            return []

        wo_ids = [w.id for w in wos]
        vendor_ids = list({w.vendor_id for w in wos if w.vendor_id})

        # Vendor users for all WO vendors in one batch
        vu_by_vendor = {}
        users_by_id = {}
        if vendor_ids:
            rows = db.session.execute(
                select(User, VendorUser.vendor_id, VendorUser.vendor_user_role)
                .join(VendorUser, VendorUser.user_id == User.id)
                .where(VendorUser.vendor_id.in_(vendor_ids))
            ).all()
            for u, vid, role in rows:
                users_by_id[u.id] = u
                vu_by_vendor.setdefault(vid, []).append(
                    {"user": u, "role": role}
                )

        # Vendors metadata batched
        vendors_by_id = {}
        if vendor_ids:
            for v in (
                db.session.execute(select(Vendor).where(Vendor.id.in_(vendor_ids)))
                .scalars()
                .all()
            ):
                vendors_by_id[v.id] = v

        # Tickets for these WOs (for contractor name lookup) batched
        ticket_rows = (
            db.session.execute(
                select(Ticket.work_order_id, Ticket.assigned_contractor)
                .where(
                    and_(
                        Ticket.work_order_id.in_(wo_ids),
                        Ticket.assigned_contractor.isnot(None),
                    )
                )
            )
            .all()
        )
        names_by_wo = {}
        all_names = set()
        for wo_id, name in ticket_rows:
            n = (name or "").strip().lower()
            if not n:
                continue
            names_by_wo.setdefault(wo_id, set()).add(n)
            all_names.add(n)

        contractors_by_name = {}
        if all_names:
            for u in (
                db.session.execute(
                    select(User).where(
                        func.lower(
                            func.concat(User.first_name, " ", User.last_name)
                        ).in_(all_names)
                    )
                )
                .scalars()
                .all()
            ):
                key = _full_name(u).strip().lower()
                contractors_by_name[key] = u
                users_by_id.setdefault(u.id, u)

        # Existing chats for this user batched: map other_user_id -> chat_id.
        # Chats are no longer WO-scoped (Neon shape), so the same chat shows
        # up under every WO this pair has work on.
        chat_rows = ChatRepository.list_for_user(user_id)
        chat_by_pair = {}
        for c in chat_rows:
            other = c.user_two_id if c.user_one_id == user_id else c.user_one_id
            chat_by_pair[other] = c.id

        tree = []
        for wo in wos:
            vendor = vendors_by_id.get(wo.vendor_id) if wo.vendor_id else None
            vendor_users_raw = vu_by_vendor.get(wo.vendor_id, []) if wo.vendor_id else []
            vendor_users = []
            for entry in vendor_users_raw:
                u = entry["user"]
                if u.id == user_id:
                    continue
                vendor_users.append(
                    {
                        "id": u.id,
                        "name": _full_name(u),
                        "role": f"vendor:{entry['role'] or 'member'}",
                        "email": u.email,
                        "phone": getattr(u, "contact_number", None),
                        "chat_id": chat_by_pair.get(u.id),
                    }
                )

            contractors = []
            for n in names_by_wo.get(wo.id, set()):
                u = contractors_by_name.get(n)
                if not u or u.id == user_id:
                    continue
                contractors.append(
                    {
                        "id": u.id,
                        "name": _full_name(u),
                        "role": "contractor",
                        "email": u.email,
                        "phone": getattr(u, "contact_number", None),
                        "chat_id": chat_by_pair.get(u.id),
                    }
                )

            tree.append(
                {
                    "id": wo.id,
                    "code": getattr(wo, "work_order_id", None),
                    "label": _wo_label(wo),
                    "description": wo.description,
                    "status": (
                        _enum_value(getattr(wo, "status", None))
                    ),
                    "vendor": (
                        {
                            "id": vendor.id,
                            "company_name": vendor.company_name or vendor.name,
                            "company_email": vendor.company_email,
                            "company_phone": vendor.company_phone,
                            "users": vendor_users,
                        }
                        if vendor
                        else None
                    ),
                    "contractors": contractors,
                }
            )
        return tree

    @staticmethod
    def get_workorder_summary(wo_id):
        """Return everything the right-rail panel needs for a single WO,
        independent of any chat: WO + vendor + tickets + invoices + MSAs.

        Returns (data, error, code).
        """
        wo = db.session.get(WorkOrder, wo_id)
        if not wo:
            return None, "Work order not found", 404
        vendor = (
            db.session.get(Vendor, wo.vendor_id) if wo.vendor_id else None
        )
        msas = (
            db.session.execute(
                select(Msa)
                .where(Msa.vendor_id == vendor.id)
                .order_by(Msa.created_at.desc())
            )
            .scalars()
            .all()
            if vendor
            else []
        )
        ticket_rows = (
            db.session.execute(
                select(Ticket)
                .where(Ticket.work_order_id == wo.id)
                .order_by(Ticket.created_at.asc())
            )
            .scalars()
            .all()
        )
        invoice_rows = (
            db.session.execute(
                select(Invoice)
                .where(Invoice.work_order_id == wo.id)
                .order_by(Invoice.invoice_date.desc())
            )
            .scalars()
            .all()
        )
        return (
            {
                "work_order": _wo_payload(wo),
                "vendor": _vendor_payload(vendor),
                "msas": [_msa_payload(m) for m in msas],
                "tickets": [_ticket_payload(t) for t in ticket_rows],
                "ticket_counts": {
                    "total": len(ticket_rows),
                    "open": sum(
                        1
                        for t in ticket_rows
                        if _enum_value(getattr(t, "status", None))
                        not in ("COMPLETED", "CANCELLED")
                    ),
                },
                "invoices": [_invoice_payload(inv) for inv in invoice_rows],
            },
            None,
            200,
        )

    @staticmethod
    def get_context(chat_id, user_id, work_order_id=None):
        """Return the context bundle the Messages page renders alongside a
        thread: other party identity + contact, work order summary (tickets,
        invoices, MSAs), and the vendor the WO is for.

        Chats are not WO-scoped (Neon shape) so the caller passes the WO id
        from the navigation context, not from the chat row.

        Returns (data, error, code).
        """
        chat = ChatRepository.get_by_id(chat_id)
        if not chat:
            return None, "Chat not found", 404
        if not ChatService.can_user_access_chat(chat, user_id):
            return None, "Forbidden", 403

        other_id = (
            chat.user_two_id if chat.user_one_id == user_id else chat.user_one_id
        )
        other = db.session.get(User, other_id)

        wo = (
            db.session.get(WorkOrder, work_order_id) if work_order_id else None
        )

        # Vendor: prefer the WO's vendor; if no WO, fall back to the other
        # user's vendor_user link.
        vendor = None
        vendor_user_role = None
        if wo and wo.vendor_id:
            vendor = db.session.get(Vendor, wo.vendor_id)
        if vendor is None:
            vu = db.session.execute(
                select(VendorUser).where(VendorUser.user_id == other_id).limit(1)
            ).scalar_one_or_none()
            if vu:
                vendor_user_role = vu.vendor_user_role
                if vu.vendor_id:
                    vendor = db.session.get(Vendor, vu.vendor_id)
        else:
            vu = db.session.execute(
                select(VendorUser)
                .where(
                    and_(
                        VendorUser.user_id == other_id,
                        VendorUser.vendor_id == vendor.id,
                    )
                )
                .limit(1)
            ).scalar_one_or_none()
            if vu:
                vendor_user_role = vu.vendor_user_role

        msas = []
        if vendor:
            msas = (
                db.session.execute(
                    select(Msa)
                    .where(Msa.vendor_id == vendor.id)
                    .order_by(Msa.created_at.desc())
                )
                .scalars()
                .all()
            )

        # Best-effort contractor flag: matches name to any of the WO's tickets.
        is_contractor = False
        if wo and other:
            full = _full_name(other).strip().lower()
            if full:
                names = (
                    db.session.execute(
                        select(Ticket.assigned_contractor).where(
                            and_(
                                Ticket.work_order_id == wo.id,
                                Ticket.assigned_contractor.isnot(None),
                            )
                        )
                    )
                    .scalars()
                    .all()
                )
                is_contractor = any(
                    (n or "").strip().lower() == full for n in names
                )

        if other and vendor_user_role:
            role_label = f"vendor:{vendor_user_role}"
        elif is_contractor:
            role_label = "contractor"
        elif other and getattr(other, "user_type", None):
            role_label = _enum_value(other.user_type) or "user"
        else:
            role_label = "user"

        # Tickets + invoices for the WO
        tickets = []
        invoices = []
        ticket_counts = None
        if wo:
            ticket_rows = (
                db.session.execute(
                    select(Ticket)
                    .where(Ticket.work_order_id == wo.id)
                    .order_by(Ticket.created_at.asc())
                )
                .scalars()
                .all()
            )
            tickets = [
                {
                    "id": t.id,
                    "description": t.description,
                    "status": _enum_value(getattr(t, "status", None)),
                    "priority": _enum_value(getattr(t, "priority", None)),
                    "due_date": (
                        t.due_date.isoformat() if t.due_date else None
                    ),
                    "assigned_contractor": t.assigned_contractor,
                }
                for t in ticket_rows
            ]
            ticket_counts = {
                "total": len(tickets),
                "open": sum(
                    1
                    for t in ticket_rows
                    if _enum_value(getattr(t, "status", None))
                    not in ("COMPLETED", "CANCELLED")
                ),
            }
            invoice_rows = (
                db.session.execute(
                    select(Invoice)
                    .where(Invoice.work_order_id == wo.id)
                    .order_by(Invoice.invoice_date.desc())
                )
                .scalars()
                .all()
            )
            invoices = [
                {
                    "id": inv.id,
                    "status": _enum_value(getattr(inv, "invoice_status", None)),
                    "total_amount": (
                        float(inv.total_amount)
                        if inv.total_amount is not None
                        else None
                    ),
                    "invoice_date": (
                        inv.invoice_date.isoformat()
                        if inv.invoice_date
                        else None
                    ),
                    "due_date": (
                        inv.due_date.isoformat() if inv.due_date else None
                    ),
                }
                for inv in invoice_rows
            ]

        return (
            {
                "chat_id": chat.id,
                "other_user": (
                    {
                        "id": other.id,
                        "name": _full_name(other),
                        "role": role_label,
                        "email": other.email,
                        "phone": getattr(other, "contact_number", None),
                        "alternate_phone": getattr(other, "alternate_number", None),
                        "user_type": _enum_value(getattr(other, "user_type", None)),
                    }
                    if other
                    else None
                ),
                "work_order": (
                    {
                        "id": wo.id,
                        "code": getattr(wo, "work_order_id", None),
                        "label": _wo_label(wo),
                        "description": wo.description,
                        "status": (
                            _enum_value(getattr(wo, "status", None))
                        ),
                        "priority": _enum_value(getattr(wo, "priority", None)),
                    }
                    if wo
                    else None
                ),
                "vendor": (
                    {
                        "id": vendor.id,
                        "company_name": vendor.company_name or vendor.name,
                        "company_email": vendor.company_email,
                        "company_phone": vendor.company_phone,
                        "primary_contact_name": vendor.primary_contact_name,
                        "vendor_code": vendor.vendor_code,
                    }
                    if vendor
                    else None
                ),
                "msas": [
                    {
                        "id": m.id,
                        "file_name": m.file_name,
                        "version": m.version,
                        "status": m.status,
                        "effective_date": (
                            m.effective_date.isoformat()
                            if m.effective_date
                            else None
                        ),
                    }
                    for m in msas
                ],
                "tickets": tickets,
                "ticket_counts": ticket_counts,
                "invoices": invoices,
            },
            None,
            200,
        )

    @staticmethod
    def list_inbox(user_id):
        """Flat inbox of every conversation for the current user, ordered by
        most-recent-message. WO context isn't on the chat row (Neon shape) so
        callers that need WO context should use list_workorder_tree instead.
        """
        chats = ChatRepository.list_for_user(user_id)
        if not chats:
            return []

        other_ids = [
            c.user_two_id if c.user_one_id == user_id else c.user_one_id
            for c in chats
        ]
        users = (
            db.session.execute(select(User).where(User.id.in_(other_ids)))
            .scalars()
            .all()
        )
        users_by_id = {u.id: u for u in users}

        out = []
        for c in chats:
            other_id = c.user_two_id if c.user_one_id == user_id else c.user_one_id
            other = users_by_id.get(other_id)
            last_msg = (
                db.session.execute(
                    select(Message)
                    .where(Message.chat_id == c.id)
                    .order_by(Message.created_at.desc())
                    .limit(1)
                )
                .scalars()
                .first()
            )
            out.append(
                {
                    "id": c.id,
                    "other_user_id": other_id,
                    "other_user_name": _full_name(other) if other else other_id,
                    "last_message": (
                        {
                            "body": last_msg.body,
                            "created_at": (
                                last_msg.created_at.isoformat()
                                if last_msg.created_at
                                else None
                            ),
                            "sender_id": last_msg.sender_id,
                        }
                        if last_msg
                        else None
                    ),
                    "updated_at": (
                        c.updated_at.isoformat() if c.updated_at else None
                    ),
                }
            )

        out.sort(
            key=lambda x: (
                x["last_message"]["created_at"] if x["last_message"] else ""
            ),
            reverse=True,
        )
        return out

    @staticmethod
    def open_chat(wo_id, current_user_id, recipient_id):
        """Idempotent: returns the global 1-on-1 chat for the pair. The
        wo_id is used only to validate that the recipient is associated
        with that work order; the chat row itself is not WO-scoped (matches
        Neon's chat schema).
        """
        wo = ChatService.get_workorder(wo_id)
        if not wo:
            return None, "Work order not found", 404

        eligible = {r["id"] for r in (ChatService.get_recipients(wo_id, current_user_id) or [])}
        if recipient_id not in eligible:
            return None, "Recipient is not associated with this work order", 403

        chat, _ = ChatRepository.find_or_create(current_user_id, recipient_id)
        return chat, None, 200

    @staticmethod
    def post_message(chat_id, sender_id, body, attachment=None):
        chat = ChatRepository.get_by_id(chat_id)
        if not chat:
            return None, "Chat not found", 404
        if not ChatService.can_user_access_chat(chat, sender_id):
            return None, "Forbidden", 403
        recipient_id = (
            chat.user_two_id if sender_id == chat.user_one_id else chat.user_one_id
        )

        if attachment is not None:
            data = attachment.read()
            if len(data) > MAX_ATTACHMENT_BYTES:
                return None, "Attachment exceeds 10 MB limit", 413
            msg = MessageRepository.create(chat_id, sender_id, recipient_id, body or "")
            FileAttachmentRepository.create(
                message_id=msg.id,
                filename=attachment.filename or "attachment",
                mime_type=attachment.mimetype or "application/octet-stream",
                content=data,
            )
            db.session.refresh(msg)
            return msg, None, 201

        if not body or not body.strip():
            return None, "Body is required when no attachment is provided", 400

        msg = MessageRepository.create(chat_id, sender_id, recipient_id, body.strip())
        return msg, None, 201

    @staticmethod
    def list_messages(chat_id, user_id, after=None):
        chat = ChatRepository.get_by_id(chat_id)
        if not chat:
            return None, "Chat not found", 404
        if not ChatService.can_user_access_chat(chat, user_id):
            return None, "Forbidden", 403
        return MessageRepository.list_by_chat(chat_id, after=after), None, 200


def _enum_value(value):
    """Render an Enum as its value (e.g. 'COMPLETED'), not its full name
    ('StatusEnum.COMPLETED'). Plain Python Enums (not str-mixed) need this.
    """
    if value is None:
        return None
    if hasattr(value, "value"):
        v = value.value
        return v.upper() if isinstance(v, str) else v
    return str(value)


def _full_name(user):
    parts = [user.first_name or "", user.last_name or ""]
    name = " ".join(p for p in parts if p).strip()
    return name or user.username or user.email or user.id


def _wo_payload(wo):
    if not wo:
        return None
    return {
        "id": wo.id,
        "code": getattr(wo, "work_order_id", None),
        "label": _wo_label(wo),
        "description": wo.description,
        "status": _enum_value(getattr(wo, "status", None)),
        "priority": _enum_value(getattr(wo, "priority", None)),
    }


def _vendor_payload(vendor):
    if not vendor:
        return None
    return {
        "id": vendor.id,
        "company_name": vendor.company_name or vendor.name,
        "company_email": vendor.company_email,
        "company_phone": vendor.company_phone,
        "primary_contact_name": vendor.primary_contact_name,
        "vendor_code": vendor.vendor_code,
    }


def _msa_payload(m):
    return {
        "id": m.id,
        "file_name": m.file_name,
        "version": m.version,
        "status": m.status,
        "effective_date": (
            m.effective_date.isoformat() if m.effective_date else None
        ),
    }


def _ticket_payload(t):
    return {
        "id": t.id,
        "description": t.description,
        "status": _enum_value(getattr(t, "status", None)),
        "priority": _enum_value(getattr(t, "priority", None)),
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "assigned_contractor": t.assigned_contractor,
    }


def _invoice_payload(inv):
    return {
        "id": inv.id,
        "status": _enum_value(getattr(inv, "invoice_status", None)),
        "total_amount": (
            float(inv.total_amount) if inv.total_amount is not None else None
        ),
        "invoice_date": (
            inv.invoice_date.isoformat() if inv.invoice_date else None
        ),
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
    }


def _wo_label(wo):
    code = getattr(wo, "work_order_id", None)
    if code:
        return f"WO #{code}"
    return f"WO {wo.id[:8]}"
