# VistaOne

## Project Information

**Project Name:** Client Web Dashboard  
**Team Name:** Team Client Web  
**Cohort / Sprint:** Coding Temple Tech Residency — 42  
**Team Members:**

- Lasia Koppaka — Backend
- Shaney Hoyohoy — Backend
- Deepalakshmi Lakshminarasimhan — Full Stack (Backend)
- Dhanushka Magmmudalige — Full Stack (Frontend)
- Aharon Abdus-Salaam — Full Stack (Frontend)
- Thomas Lappas — Full Stack (Frontend)
- Ryan Weidenbenner — Data Analyst
- Troy Adamson — Cybersecurity
- Rosalina Geslani Huynh — Cybersecurity
- Amber Burlet — Quality Assurance

  **Tech Stack:**
- **Frontend:** React 19, Vite, Bootstrap 5, React Router DOM, Recharts, Leaflet
- **Backend:** Python, Flask, SQLAlchemy, Flask-Migrate, Marshmallow, PyJWT, Gunicorn
- **Database:** PostgreSQL / Supabase

## Project Overview

This is the client-side web application for a field operations management platform serving the oil & gas industry.

- **What problem does it solve?** Centralizes well management, work orders, vendor relationships, contracts, and invoicing into a single platform, replacing fragmented spreadsheets and manual tracking.
- **Who is the target user?** Oil & gas companies and field operations managers who need to coordinate field assets and service vendors.
- **What core features were completed?** Well tracking, work order management, vendor directory and marketplace, contract management, invoice tracking, full RBAC (role-based access control) with custom roles and permission matrices, domain-based auto-approval for user registration, and an admin dashboard.

## Setup & Documentation

**Clone the repository**

```
git clone https://github.com/Coding-Temple-Tech-Residency/TR42-Client.git
cd TR42-Client
```

**Frontend**

```
cd vistaone-web
npm install
npm run dev
```

**Backend**

```
cd vistaone-api
pip install -r requirements.txt
flask run
```

**Required environment variables**

| Variable                  | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `FLASK_CONFIG`            | Flask environment (`DevelopmentConfig` / `ProductionConfig`) |
| `SQLALCHEMY_DATABASE_URI` | PostgreSQL connection string (Supabase)                      |
| `SECRET_KEY`              | Flask session secret key                                     |
| `MAIL_SERVER`             | SMTP server address                                          |
| `MAIL_PORT`               | SMTP port                                                    |
| `MAIL_USE_TLS`            | Enable TLS for mail (`True` / `False`)                       |
| `MAIL_USERNAME`           | Mail account username                                        |
| `MAIL_PASSWORD`           | Mail account app password                                    |
| `MAIL_DEFAULT_SENDER`     | Default sender email address                                 |
| `LOG_LEVEL`               | Logging level (e.g. `INFO`, `DEBUG`)                         |
| `LOG_FILE`                | Path to the log output file                                  |
| `FORMAT`                  | Log message format string                                    |

**API documentation**

Swagger UI is available at `http://localhost:5000/api/docs` when the backend is running.

## Notes

- Default roles (MASTER, ADMIN, USER) are seeded on startup via `init_default_roles()` and cannot be deleted.
- User registration auto-approves accounts whose email domain matches the client's configured `approved_domain`; all others are set to `PENDING_APPROVAL`.
- The MASTER role is a singleton per client — transferring it promotes the recipient and demotes the current holder to ADMIN.
- Promoting a user to ADMIN requires the `promote_admin` permission on the assigning user's role.
- The system supports unlimited custom role creation — roles are not hardcoded and can be tailored to any organizational structure.
- Each role has a dedicated permission grid covering all resources (`dashboard`, `wells`, `workorders`, `vendors`, `contracts`, `invoices`, `users`) with independent `read`, `write`, and `delete` controls per resource, allowing highly granular access configuration.
- The permission grid architecture is designed to be extensible — by attaching permissions directly to individual users rather than roles, the system can be migrated to a fully user-based access control model with minimal structural changes.


## Intellectual Property Notice

This project was created as part of a Coding Temple Tech Residency. All work produced during the residency is considered the intellectual property of Coding Temple or the sponsoring employer, unless otherwise stated in a signed agreement. By contributing to this project, you acknowledge and agree to these terms.
