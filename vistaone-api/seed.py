"""
seed.py - Provides init_company_roles() called at company registration.
Run directly to seed demo vendor data: python seed.py
"""
from app.extensions import db

ALL_RESOURCES = [
    "dashboard",
    "wells",
    "workorders",
    "vendors",
    "vendor_marketplace",
    "contracts",
    "invoices",
    "users",
    "promote_admin",
]

BUILT_IN_ROLE_NAMES = {"MASTER", "ADMIN", "USER"}

_BUILT_IN_ROLES = [
    {
        "name": "MASTER",
        "description": "Full system access. Can manage roles, users, and company settings.",
        "is_default": False,
        "permissions": [],  # MASTER permissions are handled in code, not stored in DB
    },
    {
        "name": "ADMIN",
        "description": "Administrative access. Can manage users and most resources.",
        "is_default": False,
        "permissions": [
            {"resource": r, "can_read": True, "can_write": True, "can_delete": False}
            for r in ALL_RESOURCES
            if r != "promote_admin"
        ],
    },
    {
        "name": "USER",
        "description": "Standard read-only access. Automatically assigned to new registrations.",
        "is_default": True,   # auto-assigned to new users for this company
        "permissions": [
            {"resource": r, "can_read": True, "can_write": False, "can_delete": False}
            for r in [
                "dashboard", "wells", "workorders", "vendors",
                "vendor_marketplace", "contracts", "invoices",
            ]
        ],
    },
]


def seed_demo_tickets():
    """Create 2-3 example tickets for every existing work order that has none.
    Idempotent — skips work orders that already have tickets attached.
    """
    from datetime import datetime, timedelta, timezone
    from app.models.workorder import WorkOrder
    from app.models.ticket import Ticket
    from app.blueprints.enum.enums import TicketStatusEnum, PriorityEnum

    _TICKET_TEMPLATES = [
        ("Initial site assessment and equipment staging", PriorityEnum.HIGH, TicketStatusEnum.COMPLETED, 0),
        ("Primary work execution", PriorityEnum.MEDIUM, TicketStatusEnum.IN_PROGRESS, 2),
        ("Site cleanup and final inspection", PriorityEnum.LOW, TicketStatusEnum.UNASSIGNED, 5),
    ]

    work_orders = WorkOrder.query.all()
    created_total = 0
    for wo in work_orders:
        if Ticket.query.filter_by(work_order_id=wo.id).first():
            continue
        now = datetime.now(timezone.utc)
        for desc, priority, status, day_offset in _TICKET_TEMPLATES:
            db.session.add(Ticket(
                work_order_id=wo.id,
                vendor_id=wo.vendor_id,
                service_type=wo.service_type_id,
                description=f"{desc} — {wo.description}",
                priority=priority,
                status=status,
                due_date=now + timedelta(days=day_offset + 3),
                start_time=now - timedelta(days=1) if status != TicketStatusEnum.UNASSIGNED else None,
            ))
            created_total += 1
    if created_total:
        db.session.commit()
    return created_total


def init_company_roles(client_id):
    """Create MASTER, ADMIN, USER roles for a company. Idempotent."""
    from app.models.role import Role
    from app.models.permission import Permission

    for role_def in _BUILT_IN_ROLES:
        if Role.query.filter_by(name=role_def["name"], client_id=client_id).first():
            continue

        role = Role(
            name=role_def["name"],
            description=role_def["description"],
            is_default=role_def["is_default"],
            client_id=client_id,
        )
        db.session.add(role)
        db.session.flush()

        for pdata in role_def["permissions"]:
            db.session.add(Permission(
                role_id=role.id,
                resource=pdata["resource"],
                can_read=pdata.get("can_read", False),
                can_write=pdata.get("can_write", False),
                can_delete=pdata.get("can_delete", False),
            ))

    # Flush only — let the caller own the transaction so a failure later in
    # registration can roll roles/permissions back along with everything else.
    db.session.flush()


if __name__ == "__main__":
    from app import create_app
    from app.models.vendor import Vendor
    from app.blueprints.enum.enums import VendorStatus, ComplianceStatus

    app = create_app("DevelopmentConfig")

    with app.app_context():
        db.create_all()

        vendors_data = [
            {
                "company_name": "Permian Wellbore Services",
                "company_code": "PWS-001",
                "primary_contact_name": "Carlos Mendez",
                "company_email": "cmendez@permianwell.com",
                "company_phone": "(432) 555-0142",
                "status": VendorStatus.ACTIVE,
                "compliance_status": ComplianceStatus.COMPLETE,
                "onboarding": False,
                "description": "Full-service wellbore integrity and cleaning provider",
            },
            {
                "company_name": "Basin Pump & Flow",
                "company_code": "BPF-002",
                "primary_contact_name": "Dana Reyes",
                "company_email": "dreyes@basinpump.com",
                "company_phone": "(432) 555-0198",
                "status": VendorStatus.ACTIVE,
                "compliance_status": ComplianceStatus.COMPLETE,
                "onboarding": False,
                "description": "Water transport, refill, and pump replacement services",
            },
            {
                "company_name": "West Texas Cementing",
                "company_code": "WTC-003",
                "primary_contact_name": "James Whitfield",
                "company_email": "jwhitfield@wtcement.com",
                "company_phone": "(432) 555-0267",
                "status": VendorStatus.INACTIVE,
                "compliance_status": ComplianceStatus.EXPIRED,
                "onboarding": False,
                "description": "Cementing services for well construction and remediation",
            },
            {
                "company_name": "Midland Pipeline Solutions",
                "company_code": "MPS-004",
                "primary_contact_name": "Priya Sharma",
                "company_email": "psharma@midlandpipe.com",
                "company_phone": "(432) 555-0314",
                "status": VendorStatus.ACTIVE,
                "compliance_status": ComplianceStatus.COMPLETE,
                "onboarding": False,
                "description": "Pipeline survey, transportation, and plug and abandon services",
            },
            {
                "company_name": "Sandstorm Stimulation",
                "company_code": "SST-005",
                "primary_contact_name": "Marcus Bell",
                "company_email": "mbell@sandstormstim.com",
                "company_phone": "(432) 555-0089",
                "status": VendorStatus.INACTIVE,
                "compliance_status": ComplianceStatus.INCOMPLETE,
                "onboarding": True,
                "description": "Stimulation and well refill operations",
            },
            {
                "company_name": "Eagle Ford Logistics",
                "company_code": "EFL-006",
                "primary_contact_name": "Teresa Nguyen",
                "company_email": "tnguyen@eaglefordlog.com",
                "company_phone": "(432) 555-0451",
                "status": VendorStatus.INACTIVE,
                "compliance_status": ComplianceStatus.EXPIRED,
                "onboarding": False,
                "description": "Water and oil transportation with flowback capabilities",
            },
        ]

        for vdata in vendors_data:
            if db.session.query(Vendor).filter_by(company_name=vdata["company_name"]).first():
                print(f"  Vendor already exists: {vdata['company_name']}")
                continue
            db.session.add(Vendor(**vdata))
            db.session.commit()
            print(f"  Created vendor: {vdata['company_name']}")

        created = seed_demo_tickets()
        if created:
            print(f"  Created {created} demo tickets across work orders.")
        else:
            print("  No new tickets — all work orders already have tickets.")

        print("\nSeed complete.")
