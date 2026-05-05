"""Unit tests for ChatService.

Pure unit tests with no DB. The repository layer is patched and only the
recipient discovery + permission logic is exercised here. Integration tests
that hit a real DB belong in tests/test_controllers/.
"""
import unittest
from unittest.mock import MagicMock, patch

from app.blueprints.services.chat_service import ChatService, MAX_ATTACHMENT_BYTES


def _user(uid, first="Alex", last="Smith", username=None, email=None):
    u = MagicMock()
    u.id = uid
    u.first_name = first
    u.last_name = last
    u.username = username
    u.email = email
    return u


def _chat(user_one_id, user_two_id, chat_id="chat-1"):
    c = MagicMock()
    c.id = chat_id
    c.user_one_id = user_one_id
    c.user_two_id = user_two_id
    return c


class TestCanUserAccessChat(unittest.TestCase):
    def test_user_one_can_access(self):
        self.assertTrue(
            ChatService.can_user_access_chat(_chat("a", "b"), "a")
        )

    def test_user_two_can_access(self):
        self.assertTrue(
            ChatService.can_user_access_chat(_chat("a", "b"), "b")
        )

    def test_outsider_cannot(self):
        self.assertFalse(
            ChatService.can_user_access_chat(_chat("a", "b"), "c")
        )


class TestPostMessage(unittest.TestCase):
    @patch("app.blueprints.services.chat_service.MessageRepository")
    @patch("app.blueprints.services.chat_service.ChatRepository")
    def test_rejects_when_chat_missing(self, chat_repo, msg_repo):
        chat_repo.get_by_id.return_value = None
        msg, err, code = ChatService.post_message("missing", "u1", "hi")
        self.assertIsNone(msg)
        self.assertEqual(code, 404)

    @patch("app.blueprints.services.chat_service.MessageRepository")
    @patch("app.blueprints.services.chat_service.ChatRepository")
    def test_rejects_outside_user(self, chat_repo, msg_repo):
        chat_repo.get_by_id.return_value = _chat("a", "b")
        msg, err, code = ChatService.post_message("chat-1", "c", "hi")
        self.assertIsNone(msg)
        self.assertEqual(code, 403)

    @patch("app.blueprints.services.chat_service.MessageRepository")
    @patch("app.blueprints.services.chat_service.ChatRepository")
    def test_rejects_empty_body_without_attachment(self, chat_repo, msg_repo):
        chat_repo.get_by_id.return_value = _chat("a", "b")
        msg, err, code = ChatService.post_message("chat-1", "a", "   ")
        self.assertIsNone(msg)
        self.assertEqual(code, 400)

    @patch("app.blueprints.services.chat_service.MessageRepository")
    @patch("app.blueprints.services.chat_service.ChatRepository")
    def test_creates_message_with_correct_recipient(self, chat_repo, msg_repo):
        chat_repo.get_by_id.return_value = _chat("a", "b")
        msg_repo.create.return_value = MagicMock()
        msg, err, code = ChatService.post_message("chat-1", "a", "hello")
        self.assertEqual(code, 201)
        msg_repo.create.assert_called_once_with("chat-1", "a", "b", "hello")

    @patch("app.blueprints.services.chat_service.FileAttachmentRepository")
    @patch("app.blueprints.services.chat_service.db")
    @patch("app.blueprints.services.chat_service.MessageRepository")
    @patch("app.blueprints.services.chat_service.ChatRepository")
    def test_attachment_size_limit(
        self, chat_repo, msg_repo, db_mod, attach_repo
    ):
        chat_repo.get_by_id.return_value = _chat("a", "b")
        oversize = MagicMock()
        oversize.read.return_value = b"x" * (MAX_ATTACHMENT_BYTES + 1)
        msg, err, code = ChatService.post_message(
            "chat-1", "a", None, attachment=oversize
        )
        self.assertIsNone(msg)
        self.assertEqual(code, 413)
        msg_repo.create.assert_not_called()
        attach_repo.create.assert_not_called()


if __name__ == "__main__":
    unittest.main()
