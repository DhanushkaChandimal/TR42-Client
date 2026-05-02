from app.extensions import ma
from app.models.chat import Chat
from app.models.message import Message
from app.models.file_attachment import FileAttachment


class ChatSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Chat
        load_instance = False
        include_fk = True
        exclude = ("user_one", "user_two", "messages")


class FileAttachmentSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = FileAttachment
        load_instance = False
        include_fk = True
        exclude = ("message", "content")


class MessageSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Message
        load_instance = False
        include_fk = True
        exclude = ("chat", "sender", "recipient")

    attachments = ma.Nested(FileAttachmentSchema, many=True, dump_only=True)


chat_schema = ChatSchema()
chats_schema = ChatSchema(many=True)
message_schema = MessageSchema()
messages_schema = MessageSchema(many=True)
file_attachment_schema = FileAttachmentSchema()
file_attachments_schema = FileAttachmentSchema(many=True)
