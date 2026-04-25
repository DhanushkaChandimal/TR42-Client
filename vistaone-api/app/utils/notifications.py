from flask import current_app
from flask_mail import Message
from app.extensions import mail
import logging

logger = logging.getLogger(__name__)


def send_vendor_notification(to_email, subject, body):
    if not to_email:
        logger.warning("No vendor email on file; skipping notification")
        return False
    try:
        sender = current_app.config.get("MAIL_DEFAULT_SENDER")
        msg = Message(subject=subject, sender=sender, recipients=[to_email], body=body)
        mail.send(msg)
        logger.info(f"Vendor notification sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send vendor notification to {to_email}: {e}")
        return False
