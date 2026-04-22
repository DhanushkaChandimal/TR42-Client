from flask_mail import Message
from app.extensions import mail
from flask import current_app


def send_verification_email(user, token):
    subject = "Verify your email address"
    verify_url = f"{current_app.config.get('FRONTEND_URL', 'http://localhost:5173')}/verify-email?token={token}"
    # Support both dict and object
    if isinstance(user, dict):
        first_name = user.get("first_name", "")
        email = user.get("email", "")
    else:
        first_name = getattr(user, "first_name", "")
        email = getattr(user, "email", "")
    body = f"""
    Hi {first_name},

    Please verify your email address by clicking the link below:
    {verify_url}

    If you did not create an account, please ignore this email.
    """
    msg = Message(subject=subject, recipients=[email], body=body)
    mail.send(msg)
