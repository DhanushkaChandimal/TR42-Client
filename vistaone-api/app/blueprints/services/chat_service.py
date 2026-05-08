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

        # Vendor users (work_order stores vendor uuid in `assigned_vendor` text)
        if wo.assigned_vendor:
            vendor_users = (
                db.session.execute(
                    select(User, VendorUser.vendor_user_role)
                    .join(VendorUser, VendorUser.user_id == User.id)
                    .where(VendorUser.vendor_id == wo.assigned_vendor)
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
    def list_contacts(current_user_id):
        """Return every user the current user has an existing chat with.
        Sorted by most recent message first.

        Earlier this method also required the partner to appear in
        vendor_user or match a ticket.assigned_contractor name. That gate
        hid CLIENT-to-CLIENT chats (and any partner not yet enrolled as a
        vendor user), leaving the inbox empty even when chats existed.
        Having a chat row is the source of truth.
        """
        chats = ChatRepository.list_for_user(current_user_id)
        if not chats:
            return []

        other_to_chat = {}
        for c in chats:
            other = (
                c.user_two_id if c.user_one_id == current_user_id else c.user_one_id
            )
            other_to_chat[other] = c.id

        other_ids = list(other_to_chat.keys())
        users = (
            db.session.execute(select(User).where(User.id.in_(other_ids)))
            .scalars()
            .all()
        )
        users_by_id = {u.id: u for u in users}

        vendor_user_role_by_user = {}
        vu_rows = db.session.execute(
            select(VendorUser).where(
                and_(
                    VendorUser.user_id.in_(other_ids),
                    VendorUser.vendor_id.isnot(None),
                )
            )
        ).scalars().all()
        for vu in vu_rows:
            vendor_user_role_by_user[vu.user_id] = vu.vendor_user_role

        out = []
        for uid in other_ids:
            u = users_by_id.get(uid)
            last_msg = (
                db.session.execute(
                    select(Message)
                    .where(Message.chat_id == other_to_chat[uid])
                    .order_by(Message.created_at.desc())
                    .limit(1)
                )
                .scalars()
                .first()
            )
            role = vendor_user_role_by_user.get(uid)
            if role:
                role_label = f"vendor:{role}"
            elif u and getattr(u, "user_type", None):
                role_label = _enum_value(u.user_type) or "user"
            else:
                role_label = "user"
            out.append(
                {
                    "id": uid,
                    "name": _full_name(u) if u else uid,
                    "role": role_label,
                    "email": u.email if u else None,
                    "phone": getattr(u, "contact_number", None) if u else None,
                    "chat_id": other_to_chat[uid],
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
    def get_user_messaging_context(current_user_id, contact_id):
        """Right-rail data for the contact-centric Messages page: every WO,
        ticket, and invoice connected to the selected contact.

        Returns (data, error, code).
        """
        contact = db.session.get(User, contact_id)
        if not contact:
            return None, "Contact not found", 404

        wo_ids = set()
        vendor_ids = []
        vu = db.session.execute(
            select(VendorUser).where(VendorUser.user_id == contact_id)
        ).scalars().all()
        for v in vu:
            if v.vendor_id:
                vendor_ids.append(v.vendor_id)

        if vendor_ids:
            wos_via_vendor = db.session.execute(
                select(WorkOrder.id).where(WorkOrder.vendor_id.in_(vendor_ids))
            ).scalars().all()
            wo_ids.update(wos_via_vendor)

        full = _full_name(contact).strip().lower()
        if full:
            wos_via_tickets = db.session.execute(
                select(Ticket.work_order_id).where(
                    func.lower(Ticket.assigned_contractor) == full
                )
            ).scalars().all()
            wo_ids.update(w for w in wos_via_tickets if w)

        wos = []
        tickets = []
        invoices = []
        if wo_ids:
            wo_rows = db.session.execute(
                select(WorkOrder).where(WorkOrder.id.in_(wo_ids))
            ).scalars().all()
            wos = [_wo_payload(w) for w in wo_rows]

            ticket_rows = []
            if full:
                ticket_rows = db.session.execute(
                    select(Ticket).where(
                        func.lower(Ticket.assigned_contractor) == full
                    )
                ).scalars().all()
            elif vendor_ids:
                ticket_rows = db.session.execute(
                    select(Ticket).where(Ticket.vendor_id.in_(vendor_ids))
                ).scalars().all()
            tickets = [_ticket_payload(t) for t in ticket_rows]

            invoice_rows = db.session.execute(
                select(Invoice)
                .where(Invoice.work_order_id.in_(wo_ids))
                .order_by(Invoice.invoice_date.desc())
            ).scalars().all()
            invoices = [_invoice_payload(inv) for inv in invoice_rows]

        return (
            {
                "contact": {
                    "id": contact.id,
                    "name": _full_name(contact),
                    "email": contact.email,
                    "phone": getattr(contact, "contact_number", None),
                    "alternate_phone": getattr(contact, "alternate_number", None),
                    "user_type": _enum_value(getattr(contact, "user_type", None)),
                },
                "work_orders": wos,
                "tickets": tickets,
                "invoices": invoices,
            },
            None,
            200,
        )

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
    def get_findable_contacts(user_id, client_id):
        """Return contacts grouped into three categories for 'New Conversation' discovery:
        - company_colleagues: other active users in the same client
        - vendor_favourites: users enrolled in the client's favourite vendors
        - ticket_contractors: contractor users name-matched from ticket records

        Users are deduplicated across groups (first group wins).
        """
        from app.models.client_user import ClientUser
        from app.models.client_vendor import ClientVendor

        seen_ids = {user_id}

        # --- Company colleagues ---
        company_colleagues = []
        if client_id:
            colleague_rows = (
                db.session.execute(
                    select(User)
                    .join(ClientUser, ClientUser.user_id == User.id)
                    .where(
                        and_(
                            ClientUser.client_id == client_id,
                            User.id != user_id,
                        )
                    )
                )
                .scalars()
                .all()
            )
            for u in colleague_rows:
                if u.id in seen_ids:
                    continue
                seen_ids.add(u.id)
                company_colleagues.append(
                    {
                        "id": u.id,
                        "name": _full_name(u),
                        "role": _enum_value(getattr(u, "user_type", None)) or "user",
                        "email": u.email,
                        "phone": getattr(u, "contact_number", None),
                    }
                )

        # --- Vendor favourite contacts ---
        vendor_favourites = []
        if client_id:
            fav_rows = (
                db.session.execute(
                    select(User, VendorUser.vendor_user_role, Vendor.company_name)
                    .join(VendorUser, VendorUser.user_id == User.id)
                    .join(Vendor, Vendor.id == VendorUser.vendor_id)
                    .join(ClientVendor, ClientVendor.vendor_id == VendorUser.vendor_id)
                    .where(
                        and_(
                            ClientVendor.client_id == client_id,
                            VendorUser.vendor_id.isnot(None),
                        )
                    )
                )
                .all()
            )
            for u, role, company_name in fav_rows:
                if u.id in seen_ids:
                    continue
                seen_ids.add(u.id)
                vendor_favourites.append(
                    {
                        "id": u.id,
                        "name": _full_name(u),
                        "role": f"vendor:{role or 'member'}",
                        "email": u.email,
                        "phone": getattr(u, "contact_number", None),
                        "company": company_name,
                    }
                )

        # --- Ticket contractors (name-matched) ---
        ticket_contractors = []
        ticket_names = (
            db.session.execute(
                select(Ticket.assigned_contractor)
                .where(Ticket.assigned_contractor.isnot(None))
                .distinct()
            )
            .scalars()
            .all()
        )
        normalized_names = {n.strip().lower() for n in ticket_names if n and n.strip()}
        if normalized_names:
            contractor_rows = (
                db.session.execute(
                    select(User).where(
                        and_(
                            func.lower(
                                func.concat(User.first_name, " ", User.last_name)
                            ).in_(normalized_names),
                            User.id.notin_(list(seen_ids)),
                        )
                    )
                )
                .scalars()
                .all()
            )
            for u in contractor_rows:
                if u.id in seen_ids:
                    continue
                seen_ids.add(u.id)
                ticket_contractors.append(
                    {
                        "id": u.id,
                        "name": _full_name(u),
                        "role": "contractor",
                        "email": u.email,
                        "phone": getattr(u, "contact_number", None),
                    }
                )

        return {
            "company_colleagues": company_colleagues,
            "vendor_favourites": vendor_favourites,
            "ticket_contractors": ticket_contractors,
        }

    @staticmethod
    def open_direct_chat(current_user_id, recipient_id):
        """Open or return the global 1-on-1 chat between two users directly,
        without requiring a work order context.
        """
        recipient = db.session.get(User, recipient_id)
        if not recipient:
            return None, "Recipient not found", 404
        try:
            chat, _ = ChatRepository.find_or_create(current_user_id, recipient_id)
        except ValueError as e:
            return None, str(e), 400
        return chat, None, 200

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
