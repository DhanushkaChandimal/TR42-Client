from datetime import datetime
from flask import Blueprint, jsonify, request, send_file
from io import BytesIO
import logging

from app.blueprints.services.chat_service import ChatService
from app.blueprints.repository.chat_repository import (
    ChatRepository,
    MessageRepository,
    FileAttachmentRepository,
)
from app.blueprints.schema.chat_schema import (
    chat_schema,
    chats_schema,
    message_schema,
    messages_schema,
)
from app.utils.util import permission_required

logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/chats", methods=["GET"])
@permission_required("workorders", "read")
def list_inbox(user_id):
    return jsonify({"chats": ChatService.list_inbox(user_id)}), 200


@chat_bp.route("/messages/tree", methods=["GET"])
@permission_required("workorders", "read")
def list_tree(user_id):
    return jsonify({"workorders": ChatService.list_workorder_tree(user_id)}), 200


@chat_bp.route("/workorders/<wo_id>/messaging-context", methods=["GET"])
@permission_required("workorders", "read")
def workorder_messaging_context(user_id, wo_id):
    data, err, code = ChatService.get_workorder_summary(wo_id)
    if err:
        return jsonify({"message": err}), code
    return jsonify(data), 200


@chat_bp.route("/workorders/<wo_id>/recipients", methods=["GET"])
@permission_required("workorders", "read")
def list_recipients(user_id, wo_id):
    recipients = ChatService.get_recipients(wo_id, user_id)
    if recipients is None:
        return jsonify({"message": "Work order not found"}), 404
    return jsonify({"recipients": recipients}), 200


@chat_bp.route("/workorders/<wo_id>/chats", methods=["GET"])
@permission_required("workorders", "read")
def list_chats(user_id, wo_id):
    chats = ChatRepository.list_for_user_on_workorder(wo_id, user_id)
    return jsonify({"chats": chats_schema.dump(chats)}), 200


@chat_bp.route("/workorders/<wo_id>/chats", methods=["POST"])
@permission_required("workorders", "read")
def open_chat(user_id, wo_id):
    payload = request.get_json(silent=True) or {}
    recipient_id = payload.get("recipient_id")
    if not recipient_id:
        return jsonify({"message": "recipient_id is required"}), 400
    chat, err, code = ChatService.open_chat(wo_id, user_id, recipient_id)
    if err:
        return jsonify({"message": err}), code
    return jsonify(chat_schema.dump(chat)), code


@chat_bp.route("/chats/<chat_id>/messages", methods=["GET"])
@permission_required("workorders", "read")
def list_messages(user_id, chat_id):
    after_raw = request.args.get("after")
    after = None
    if after_raw:
        try:
            after = datetime.fromisoformat(after_raw.replace("Z", "+00:00"))
        except ValueError:
            return jsonify({"message": "Invalid 'after' timestamp"}), 400
    msgs, err, code = ChatService.list_messages(chat_id, user_id, after=after)
    if err:
        return jsonify({"message": err}), code
    return jsonify({"messages": messages_schema.dump(msgs)}), 200


@chat_bp.route("/chats/<chat_id>/messages", methods=["POST"])
@permission_required("workorders", "read")
def post_message(user_id, chat_id):
    body = None
    attachment = None
    if request.content_type and request.content_type.startswith("multipart/"):
        body = request.form.get("body")
        attachment = request.files.get("attachment")
    else:
        payload = request.get_json(silent=True) or {}
        body = payload.get("body")

    msg, err, code = ChatService.post_message(
        chat_id, user_id, body, attachment=attachment
    )
    if err:
        return jsonify({"message": err}), code
    return jsonify(message_schema.dump(msg)), code


@chat_bp.route("/chats/<chat_id>/context", methods=["GET"])
@permission_required("workorders", "read")
def chat_context(user_id, chat_id):
    work_order_id = request.args.get("work_order_id")
    data, err, code = ChatService.get_context(
        chat_id, user_id, work_order_id=work_order_id
    )
    if err:
        return jsonify({"message": err}), code
    return jsonify(data), 200


@chat_bp.route("/messages/<message_id>/attachments/<attachment_id>", methods=["GET"])
@permission_required("workorders", "read")
def download_attachment(user_id, message_id, attachment_id):
    msg = MessageRepository.get_by_id(message_id)
    if not msg:
        return jsonify({"message": "Message not found"}), 404
    chat = ChatRepository.get_by_id(msg.chat_id)
    if not chat or not ChatService.can_user_access_chat(chat, user_id):
        return jsonify({"message": "Forbidden"}), 403
    att = FileAttachmentRepository.get_by_id(attachment_id)
    if not att or att.message_id != message_id:
        return jsonify({"message": "Attachment not found"}), 404
    return send_file(
        BytesIO(att.content),
        mimetype=att.mime_type,
        as_attachment=True,
        download_name=att.filename,
    )
