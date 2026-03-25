from app import create_app
from app.models import db, User
import unittest

class TestUser(unittest.TestCase):
    def setUp(self):
        self.app = create_app("TestingConfig")
        self.user = User(
            first_name="Test",
            last_name="User",
            email="test@email.com",
            role_id=1,
            company_id=1,
            password_hash=""
        )
        self.user.set_password('test')
        with self.app.app_context():
            db.drop_all()
            db.create_all()
            db.session.add(self.user)
            db.session.commit()
        self.client = self.app.test_client()

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
