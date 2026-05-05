from app.models.role import Role
from app.models.permission import Permission
from app.extensions import db
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError


class RoleRepository:
    @staticmethod
    def get_roles_for_client(client_id):
        return Role.query.filter_by(client_id=client_id).all()

    @staticmethod
    def get_role_by_id(role_id):
        return Role.query.get(role_id)

    @staticmethod
    def get_custom_role_by_name(client_id, name):
        return Role.query.filter(
            func.lower(Role.name) == name.lower(),
            Role.client_id == client_id,
        ).first()

    @staticmethod
    def create_role(name, description, client_id):
        role = Role(name=name, description=description, is_default=False, client_id=client_id)
        try:
            db.session.add(role)
            db.session.commit()
            return role
        except SQLAlchemyError:
            db.session.rollback()
            raise

    @staticmethod
    def update_role(role, name=None, description=None):
        if name is not None:
            role.name = name
        if description is not None:
            role.description = description
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise
        return role

    @staticmethod
    def migrate_users_from_role(from_role, to_role):
        """Add to_role to every user who has from_role (before from_role is deleted)."""
        for user in list(from_role.users):
            if to_role not in user.roles:
                user.roles.append(to_role)
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise

    @staticmethod
    def delete_role(role):
        try:
            db.session.delete(role)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise

    @staticmethod
    def set_permissions(role, permissions_data):
        """Replace all permissions for a role.
        permissions_data: list of {"resource": str, "can_read": bool, "can_write": bool, "can_delete": bool}
        """
        Permission.query.filter_by(role_id=role.id).delete()
        for p in permissions_data:
            perm = Permission(
                role_id=role.id,
                resource=p["resource"],
                can_read=p.get("can_read", False),
                can_write=p.get("can_write", False),
                can_delete=p.get("can_delete", False),
            )
            db.session.add(perm)
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise
