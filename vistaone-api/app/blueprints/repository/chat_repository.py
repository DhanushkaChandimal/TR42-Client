from sqlalchemy import select, and_, or_
from app.extensions import db
from app.models.chat import Chat
from app.models.message import Message
from app.models.file_attachment import FileAttachment
import logging

logger = logging.getLogger(__name__)


def _canonical_pair(a, b):
    """Return (low, high) so chat lookups don't depend on initiator order."""
    return (a, b) if a <= b else (b, a)


class ChatRepository:

    @staticmethod
    def find_or_create(current_user_id, recipient_id):
        """One global 1-on-1 chat per user pair. Mirrors Neon's chat shape."""
        if current_user_id == recipient_id:
            raise ValueError("Cannot start a chat with yourself")
        u1, u2 = _canonical_pair(current_user_id, recipient_id)
        existing = db.session.execute(
            select(Chat).where(
                and_(Chat.user_one_id == u1, Chat.user_two_id == u2)
            )
        ).scalar_one_or_none()
        if existing:
            return existing, False
        chat = Chat(user_one_id=u1, user_two_id=u2)
        db.session.add(chat)
        db.session.commit()
        return chat, True

    @staticmethod
    def list_for_user(user_id):
        return (
            db.session.execute(
                select(Chat).where(
                    or_(Chat.user_one_id == user_id, Chat.user_two_id == user_id)
                )
            )
            .scalars()
            .all()
        )

    @staticmethod
    def get_by_id(chat_id):
        return db.session.get(Chat, chat_id)


class MessageRepository:

    @staticmethod
    def list_by_chat(chat_id, after=None, before=None, limit=None):
        """Fetch messages for a chat, ordered oldest-first.

        - `after`  : only messages created strictly after this timestamp.
                     Used by realtime polling.
        - `before` : only messages created strictly before this timestamp.
                     Used by 'load older messages' pagination.
        - `limit`  : when set, returns the most recent N matches and reverses
                     them to ASC, so the caller still sees oldest-first.
        """
        stmt = select(Message).where(Message.chat_id == chat_id)
        if after:
            stmt = stmt.where(Message.created_at > after)
        if before:
            stmt = stmt.where(Message.created_at < before)

        if limit:
            stmt = stmt.order_by(Message.created_at.desc()).limit(limit)
            rows = db.session.execute(stmt).scalars().all()
            return list(reversed(rows))

        stmt = stmt.order_by(Message.created_at.asc())
        return db.session.execute(stmt).scalars().all()

    @staticmethod
    def create(chat_id, sender_id, recipient_id, body):
        msg = Message(
            chat_id=chat_id,
            sender_id=sender_id,
            recipient_id=recipient_id,
            body=body,
            created_by=sender_id,
            updated_by=sender_id,
        )
        db.session.add(msg)
        db.session.commit()
        return msg

    @staticmethod
    def get_by_id(message_id):
        return db.session.get(Message, message_id)


class FileAttachmentRepository:

    @staticmethod
    def create(message_id, filename, mime_type, content):
        att = FileAttachment(
            message_id=message_id,
            filename=filename,
            mime_type=mime_type,
            content=content,
        )
        db.session.add(att)
        db.session.commit()
        return att

    @staticmethod
    def get_by_id(attachment_id):
        return db.session.get(FileAttachment, attachment_id)
