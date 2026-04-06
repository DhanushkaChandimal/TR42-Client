# tests/test_controllers/test_auth_routes.py
import token
from urllib import response
from wsgiref import headers

from app.models import db, User
from app import create_app
import unittest

# tests API routes/controllers for login functionality, including successful login, invalid credentials, and input validation errors. Also tests rate limiting on login endpoint.
# Test the API endpoint (e.g., /users/login) using Flask test client
class TestLoginRoutes(unittest.TestCase):

    def setUp(self):

        self.app = create_app("TestingConfig")

        self.app_context = self.app.app_context()
    # push the app context before accessing DB resources
        self.app_context.push() 

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
        self.client = self.app.test_client() # use test client to make API requests in tests

# ensure DB session is removed and tables are dropped after each test to maintain test isolation and clean state
    def tearDown(self):

        db.session.remove()
        db.drop_all()
        self.app_context.pop()


    def test_login_user(self):
        credentials = {
            "email": "test@email.com",
            "password": "test"
        }

        response = self.client.post('/users/login', json=credentials)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['status'], 'success')
        self.assertIn('token', response.json)

    def test_invalid_login(self):
        credentials = {
            "email": "bad_email@email.com",
            "password": "bad_pw"
        }

        response = self.client.post('/users/login', json=credentials)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json['message'], 'Invalid email or password')

    def test_login_invalid_email_format(self):
        credentials = {
            "email": "bad-email-format",
            "password": "test"
        }

        response = self.client.post('/users/login', json=credentials)
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.json)

    def test_missing_required_field(self):
        credentials = {
            "email": "test@email.com"
        }

        response = self.client.post('/users/login', json=credentials)
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json)

    def test_login_rate_limited(self):
        credentials = {
            "email": "bad_email@email.com",
            "password": "bad_pw"
        }

        response = None
        for _ in range(11):
            response = self.client.post('/users/login', json=credentials)

        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json['message'], 'Too many requests. Please try again later.')



    ### Logout Tests ###


    def test_logout_success(self):
        # Login first to get token
        credentials = {"email": "test@email.com", "password": "test"}
        login_resp = self.client.post('/users/login', json=credentials)
        token = login_resp.json['token']

        # Logout using token
        headers = {"Authorization": f"Bearer {token}"}
        response = self.client.post('/users/logout', headers=headers)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['status'], 'success')

    def test_logout_unauthorized(self):
        response = self.client.post('/users/logout')  # No token
        self.assertEqual(response.status_code, 401)
        self.assertIn('Token is missing', response.json['message'])


    def test_logout_token_revoked(self):
           # Login first
        credentials = {"email": "test@email.com", "password": "test"}
        login_resp = self.client.post('/users/login', json=credentials)
        token = login_resp.json['token']

        # Logout to revoke token
        headers = {"Authorization": f"Bearer {token}"}
        self.client.post('/users/logout', headers=headers)

        # Try accessing logout again with revoked token
        response = self.client.post('/users/logout', headers=headers)
        self.assertEqual(response.status_code, 401)
        self.assertIn('Token has been revoked', response.json['message'])  
