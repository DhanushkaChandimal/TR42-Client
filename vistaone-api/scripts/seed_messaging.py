"""Seed messaging test data into the local DB.

Creates two vendor users (linked via `vendor_user` to the first WO's vendor)
and two contractor users (linked to two of that WO's tickets via name match
on `ticket.assigned_contractor`). Idempotent: re-running skips already-seeded
rows by username.

All seed users get the same password "password123" for ease of login.

Run from vistaone-api/ with the same env the app uses:
    FLASK_CONFIG=DevelopmentConfig python scripts/seed_messaging.py
"""
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, text  # noqa: E402
from werkzeug.security import generate_password_hash  # noqa: E402

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.vendor import Vendor  # noqa: E402
from app.models.workorder import WorkOrder  # noqa: E402
from app.models.ticket import Ticket  # noqa: E402
from app.models.vendor_user import VendorUser  # noqa: E402
from app.blueprints.enum.enums import UserType  # noqa: E402


SEED_PASSWORD = "password123"


SEED_USERS = [
    # vendor users
    {
        "username": "vendor.lead",
        "email": "vendor.lead@example.com",
        "first_name": "Pat",
        "last_name": "Vendor",
        "user_type": UserType.VENDOR,
        "contact_number": "555-100-2000",
        "kind": "vendor",
        "vendor_user_role": "primary_contact",
    },
    {
        "username": "vendor.ops",
        "email": "vendor.ops@example.com",
        "first_name": "Jordan",
        "last_name": "Operations",
        "user_type": UserType.VENDOR,
        "contact_number": "555-100-2001",
        "kind": "vendor",
        "vendor_user_role": "operations",
    },
    # contractors
    {
        "username": "mike.contractor",
        "email": "mike.contractor@example.com",
        "first_name": "Mike",
        "last_name": "Johnson",
        "user_type": UserType.CONTRACTOR,
        "contact_number": "555-200-3000",
        "kind": "contractor",
    },
    {
        "username": "sara.contractor",
        "email": "sara.contractor@example.com",
        "first_name": "Sara",
        "last_name": "Lopez",
        "user_type": UserType.CONTRACTOR,
        "contact_number": "555-200-3001",
        "kind": "contractor",
    },
]


def get_or_create_user(spec, client_id):
    """Insert via raw SQL because User.client_id is a derived property (no
    setter) but the local DB still has client_id as a NOT NULL column on
    auth_user. Bypassing the ORM avoids the model/DB drift here.
    """
    existing_id = db.session.execute(
        text("SELECT id FROM auth_user WHERE username = :u"),
        {"u": spec["username"]},
    ).scalar()
    if existing_id:
        return existing_id, False

    new_id = str(uuid.uuid4())
    db.session.execute(
        text(
            "INSERT INTO auth_user "
            "(id, username, email, password_hash, user_type, status, "
            "first_name, last_name, contact_number, client_id, "
            "is_active, token_version, created_at, updated_at) "
            "VALUES (:id, :u, :em, :ph, :ut, :st, :fn, :ln, :cn, :cid, "
            "true, 0, NOW(), NOW())"
        ),
        {
            "id": new_id,
            "u": spec["username"],
            "em": spec["email"],
            "ph": generate_password_hash(SEED_PASSWORD),
            "ut": spec["user_type"].value.upper(),
            "st": "ACTIVE",
            "fn": spec["first_name"],
            "ln": spec["last_name"],
            "cn": spec["contact_number"],
            "cid": client_id,
        },
    )
    return new_id, True


def get_or_create_vendor_user(user_id, vendor_id, role):
    existing = db.session.execute(
        select(VendorUser).where(
            VendorUser.user_id == user_id,
            VendorUser.vendor_id == vendor_id,
        )
    ).scalar_one_or_none()
    if existing:
        return existing, False
    row = VendorUser(
        id=str(uuid.uuid4()),
        user_id=user_id,
        vendor_id=vendor_id,
        vendor_user_role=role,
    )
    db.session.add(row)
    db.session.flush()
    return row, True


def main():
    config_name = os.getenv("FLASK_CONFIG", "DevelopmentConfig")
    app = create_app(config_name)
    with app.app_context():
        # Pick the first WO + its vendor as the seed target.
        wo = db.session.execute(
            select(WorkOrder).order_by(WorkOrder.created_at).limit(1)
        ).scalar_one_or_none()
        if not wo:
            print("No work orders in DB; nothing to seed.")
            return
        vendor = db.session.get(Vendor, wo.vendor_id) if wo.vendor_id else None
        if not vendor:
            print("Target WO has no vendor; cannot seed vendor_user.")
            return

        client_id = wo.client_id
        print(f"Seeding against WO {wo.id} (vendor: {vendor.company_name or vendor.name})")

        created_counts = {"users": 0, "vendor_users": 0, "tickets": 0}
        contractor_users = []

        for spec in SEED_USERS:
            user_id, created = get_or_create_user(spec, client_id)
            if created:
                created_counts["users"] += 1
                print(f"  + user {spec['username']}")
            else:
                print(f"  · user {spec['username']} (existing)")
            if spec["kind"] == "vendor":
                _, vu_created = get_or_create_vendor_user(
                    user_id, vendor.id, spec["vendor_user_role"]
                )
                if vu_created:
                    created_counts["vendor_users"] += 1
                    print(f"    + vendor_user link to {vendor.company_name or vendor.name}")
            else:
                contractor_users.append(
                    {
                        "id": user_id,
                        "first_name": spec["first_name"],
                        "last_name": spec["last_name"],
                    }
                )

        # Assign contractor names onto tickets so the recipient discovery picks
        # them up. Only update tickets that don't already have an assignment.
        tickets = (
            db.session.execute(
                select(Ticket)
                .where(Ticket.work_order_id == wo.id)
                .order_by(Ticket.created_at)
                .limit(len(contractor_users))
            )
            .scalars()
            .all()
        )
        for ticket, person in zip(tickets, contractor_users):
            full = f"{person['first_name']} {person['last_name']}".strip()
            if (ticket.assigned_contractor or "").strip().lower() == full.lower():
                print(f"  · ticket {ticket.id[:8]} already assigned to {full}")
                continue
            ticket.assigned_contractor = full
            created_counts["tickets"] += 1
            print(f"  + ticket {ticket.id[:8]} -> {full}")

        db.session.commit()

        print()
        print("Seed complete.")
        print(
            f"  Users: +{created_counts['users']}, "
            f"vendor_users: +{created_counts['vendor_users']}, "
            f"tickets updated: +{created_counts['tickets']}"
        )
        print(f"  Login password for all seed users: {SEED_PASSWORD!r}")


if __name__ == "__main__":
    main()
