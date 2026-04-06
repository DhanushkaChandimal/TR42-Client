# tests/test_services/test_auth_service.py

import os
import token

import jwt

from app.blueprints.services.auth_service import LoginService
from app import create_app
from app.models import db, User
import unittest
from app.utils.token_blacklist import blacklist
from app.utils.util import encode_token


# Tests business logic/service layer for login functionality, including successful login, invalid credentials, and input validation errors. Also tests rate limiting on login endpoint.
# Tests Business logic directly, withour HTTP requests.
class TestLoginService(unittest.TestCase):

    def setUp(self):

        self.app = create_app("TestingConfig")

        self.app_context = self.app.app_context()
        self.app_context.push()
        
         # Clear blacklist so each test starts fresh
        blacklist.clear()

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

        db.session.remove()
        db.drop_all()
        self.app_context.pop()


    def test_login_service_success(self):
        response, status = LoginService.login_user("test@email.com", "test")
        self.assertEqual(status, 200)
        self.assertEqual(response["status"], "success")
        self.assertIn("token", response)

    def test_login_service_invalid(self):
        response, status = LoginService.login_user("wrong@email.com", "test")
        self.assertEqual(status, 401)
        self.assertEqual(response["message"], "Invalid email or password")


    ## Logout Tests ##


    def test_logout_service_success(self):
        # Login first to get token
        resp, _ = LoginService.login_user("test@email.com", "test")
        token = resp["token"]

          # Use Flask test_request_context to simulate request
        with self.app.test_request_context('/users/logout', method='POST', headers={'Authorization': f'Bearer {token}'}
                                           ):
            response, status = LoginService.logout_user() # Pass token to logout_user
            self.assertEqual(status, 200)
            self.assertEqual(response["status"], "success")
            self.assertIn("Successfully logged out", response["message"])

    def test_logout_service_revoked_token(self):
        # Login first to get token
        resp, _ = LoginService.login_user("test@email.com", "test")
        token = resp["token"]

        # Revoke token in a request context
        with self.app.test_request_context(
            '/users/logout',
            method='POST',
            headers={'Authorization': f'Bearer {token}'}
            ):
            LoginService.logout_user()

        # Try again with revoked token
        with self.app.test_request_context(
            '/users/logout',
            method='POST',
            headers={'Authorization': f'Bearer {token}'}
            ):
            response, status = LoginService.logout_user()
            self.assertEqual(status, 401)
            self.assertIn('Token has been revoked', response.get_json()['message'])