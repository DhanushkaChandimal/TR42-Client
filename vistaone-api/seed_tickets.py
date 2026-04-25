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
from app.blueprints.enum.enums import TicketStatusEnum, PriorityEnum

app = create_app("DevelopmentConfig")

SAMPLES = [
    {
        "description": "Initial site inspection and prep — walk-through, hazard ID, equipment staging.",
        "assigned_contractor": "Diego Salinas",
        "status": TicketStatusEnum.COMPLETED,
        "priority": PriorityEnum.MEDIUM,
        "offset_days": -7,
        "duration_hours": 8,
        "estimated_quantity": 1.0,
        "unit": "site",
    },
    {
        "description": "Primary work execution — complete the scoped work per the WO description.",
        "assigned_contractor": "Maria Cortez",
        "status": TicketStatusEnum.IN_PROGRESS,
        "priority": PriorityEnum.HIGH,
        "offset_days": -2,
        "duration_hours": 16,
        "estimated_quantity": 4.0,
        "unit": "hours",
    },
    {
        "description": "Site cleanup and turnover — remove staging, photograph site, sign off with operator.",
        "assigned_contractor": "Jorge Ramirez",
        "status": TicketStatusEnum.ASSIGNED,
        "priority": PriorityEnum.LOW,
        "offset_days": 1,
        "duration_hours": 4,
        "estimated_quantity": 1.0,
        "unit": "site",
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
            start_time = now + timedelta(days=sample["offset_days"])
            duration = timedelta(hours=sample["duration_hours"])
            due_date = start_time + duration
            ticket = Ticket(
                work_order_id=wo.id,
                vendor_id=wo.vendor_id,
                service_type=wo.service_type_id,
                description=sample["description"],
                assigned_contractor=sample["assigned_contractor"],
                priority=sample["priority"],
                status=sample["status"],
                start_time=start_time,
                due_date=due_date,
                assigned_at=start_time if sample["status"] != TicketStatusEnum.UNASSIGNED else None,
                end_time=(
                    start_time + duration
                    if sample["status"] == TicketStatusEnum.COMPLETED
                    else None
                ),
                estimated_duration=duration,
                estimated_quantity=sample["estimated_quantity"],
                unit=sample["unit"],
                anomaly_flag=False,
                created_by=actor_id or "system",
            )
            db.session.add(ticket)
            created += 1

        db.session.commit()
        print(f"  WO {wo.work_order_id}: created {len(SAMPLES)} tickets")

    print(f"\nDone. Created {created} ticket(s), skipped {skipped} work order(s).")
