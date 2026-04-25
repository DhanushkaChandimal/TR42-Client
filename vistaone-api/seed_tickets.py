"""
seed_tickets.py - creates sample tickets for existing work orders
Run from vistaone-api/ with the venv active: python seed_tickets.py
Safe to re-run - skips work orders that already have tickets.
"""
from datetime import datetime, timedelta, timezone
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.workorder import WorkOrder
from app.models.ticket import Ticket
from app.blueprints.enum.enums import TicketStatusEnum

app = create_app("DevelopmentConfig")

SAMPLES = [
    {
        "title": "Initial site inspection and prep",
        "description": "Walk-through, hazard ID, equipment staging.",
        "contractor_name": "Diego Salinas",
        "status": TicketStatusEnum.APPROVED,
        "offset_days": -7,
    },
    {
        "title": "Primary work execution",
        "description": "Complete the scoped work per the WO description.",
        "contractor_name": "Maria Cortez",
        "status": TicketStatusEnum.PENDING_APPROVAL,
        "offset_days": -2,
    },
    {
        "title": "Site cleanup and turnover",
        "description": "Remove staging, photograph site, sign off with operator.",
        "contractor_name": "Jorge Ramirez",
        "status": TicketStatusEnum.COMPLETED,
        "offset_days": 0,
    },
]

with app.app_context():
    work_orders = db.session.query(WorkOrder).limit(4).all()
    if not work_orders:
        print("No work orders found. Run seed.py and create work orders first.")
        raise SystemExit(0)

    actor = db.session.query(User).first()
    actor_id = actor.id if actor else None

    created = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for wo in work_orders:
        existing = db.session.query(Ticket).filter_by(work_order_id=wo.id).count()
        if existing:
            print(f"  WO {wo.work_order_id}: already has {existing} ticket(s), skipping")
            skipped += 1
            continue

        for sample in SAMPLES:
            scheduled_start = now + timedelta(days=sample["offset_days"])
            ticket = Ticket(
                work_order_id=wo.id,
                vendor_id=wo.vendor_id,
                title=sample["title"],
                description=sample["description"],
                contractor_name=sample["contractor_name"],
                status=sample["status"],
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_start + timedelta(days=1),
                completed_at=(
                    scheduled_start + timedelta(hours=8)
                    if sample["status"]
                    in (
                        TicketStatusEnum.COMPLETED,
                        TicketStatusEnum.PENDING_APPROVAL,
                        TicketStatusEnum.APPROVED,
                    )
                    else None
                ),
                approved_at=(
                    scheduled_start + timedelta(hours=12)
                    if sample["status"] == TicketStatusEnum.APPROVED
                    else None
                ),
                approved_by=(actor_id if sample["status"] == TicketStatusEnum.APPROVED else None),
                created_by=actor_id or "system",
            )
            db.session.add(ticket)
            created += 1

        db.session.commit()
        print(f"  WO {wo.work_order_id}: created {len(SAMPLES)} tickets")

    print(f"\nDone. Created {created} ticket(s), skipped {skipped} work order(s).")
