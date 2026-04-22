"""
seed.py - populates the database with demo data for local development
Run once: python seed.py
Safe to re-run - skips records that already exist
"""
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.vendor import Vendor
from app.models.client import Client
from app.blueprints.enum.enums import VendorStatus, ComplianceStatus

app = create_app("DevelopmentConfig")

with app.app_context():

    # Create a client company for the demo user
    existing_client = db.session.query(Client).filter_by(client_id="1").first()
    if not existing_client:
        client = Client(client_id="1", name="VistaOne Energy", created_by="system")
        db.session.add(client)
        db.session.commit()
        print("Created client: VistaOne Energy (id=1)")
    else:
        print("Client already exists: VistaOne Energy")

    # Create a demo user if one does not exist
    existing_user = db.session.query(User).filter_by(email="admin@vistaone.com").first()
    if not existing_user:
        user = User(
            first_name="Admin",
            last_name="User",
            email="admin@vistaone.com",
            role_id="1",
            company_id="1",
        )
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        print("Created user: admin@vistaone.com / password123")
    else:
        print("User already exists: admin@vistaone.com")

    # Seed vendor records
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
        existing = db.session.query(Vendor).filter_by(
            company_name=vdata["company_name"]
        ).first()
        if existing:
            print(f"  Vendor already exists: {vdata['company_name']}")
            continue

        vendor = Vendor(
            name=vdata["company_name"],
            company_name=vdata["company_name"],
            company_code=vdata["company_code"],
            primary_contact_name=vdata["primary_contact_name"],
            company_email=vdata["company_email"],
            company_phone=vdata["company_phone"],
            status=vdata["status"],
            compliance_status=vdata["compliance_status"],
            onboarding=vdata["onboarding"],
            description=vdata["description"],
            created_by="system",
        )
        db.session.add(vendor)
        db.session.commit()
        print(f"  Created vendor: {vdata['company_name']}")

    print("\nSeed complete.")
