
from app.blueprints.repository.user_profile_repository import UserProfileRepository
from app.blueprints.repository.address_repository import AddressRepository
from app.blueprints.enum.enums import UserStatus

class UserProfileService:

    #  GET PROFILE
    @staticmethod
    def get_profile(user_id):
        user = UserProfileRepository.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        return user

    #  UPDATE PROFILE
    @staticmethod
    def update_profile(user_id, body):
        update_user = UserProfileRepository.get_by_id(user_id)
        if not update_user:
            raise ValueError("User not found")

        updatable_fields = [
            "first_name",
            "middle_name",
            "last_name",
            "contact_number",
            "alternate_number",
            "profile_photo",
            "date_of_birth"
        ]

        for field in updatable_fields:
            if field in body:
                setattr(update_user, field, body[field])

        #  Update Address
        if "address" in body:
            address = AddressRepository.get_or_create_address(body["address"], user_id=user_id)
            update_user.address_id = address.id

        # AUDIT FIX (IMPORTANT)
        # update_user.updated_by = str(user_id)
        UserProfileRepository.update_user()
        return update_user

    # CHANGE PASSWORD
    @staticmethod
    def change_password(user_id, data) :
        change_password_user = UserProfileRepository.get_by_id(user_id)

        if not change_password_user:
            raise ValueError("User not found")

        if not change_password_user.check_password(data["old_password"]):
            raise ValueError("Old password is incorrect")

        change_password_user.set_password(data["new_password"])

        # change_password_user.updated_by = str(user_id)
        UserProfileRepository.update_user()
        return change_password_user

    #  SOFT DELETE
    @staticmethod
    def delete_user(user_id):
        delete_user = UserProfileRepository.get_by_id(user_id)

        if not delete_user:
            raise ValueError("User not found")
        
        delete_user.status = UserStatus.DELETED

        # delete_user.updated_by= str(user_id)
        UserProfileRepository.delete_user()
        return delete_user
