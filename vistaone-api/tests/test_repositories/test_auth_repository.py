# tests/test_repositories/test_auth_repository.py
from app.blueprints.repository.auth_repository import LoginRepository
from app import create_app
from app.models import db, User
import unittest

# Tests database/repository layer for login functionality, including retrieving user by email and handling user not found scenarios.
# Tests DB queries directly
class TestLoginRepository(unittest.TestCase):

    def setUp(self):

        self.app = create_app("TestingConfig")

        self.app_context = self.app.app_context()
        self.app_context.push() #Push Context to Access App Resources
        db.create_all()
        self.user = User(
            first_name="Test",
            last_name="User",
            email="test@email.com",
            role_id=1,
            company_id=1
        )

        self.user.set_password("test")
        db.session.add(self.user)
        db.session.commit()

    def tearDown(self):

        db.session.remove() #Remove Session to Clear DB State
        db.drop_all() #Drop Tables after Test
        self.app_context.pop() #Remove Context after Test


    def test_get_user_by_email(self):
        user = LoginRepository.get_user_by_email("test@email.com")
        self.assertIsNotNone(user)
        self.assertEqual(user.email, "test@email.com")

    def test_get_user_by_email_not_found(self):
        user = LoginRepository.get_user_by_email("notfound@email.com")
        self.assertIsNone(user)


    ## test logout ##

    def test_get_user_by_email_empty(self):
        user = LoginRepository.get_user_by_email("")
        self.assertIsNone(user)