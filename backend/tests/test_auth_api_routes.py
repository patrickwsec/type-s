import httpx

from app.core.database import get_database
from app.core.security import get_password_hash
from app.main import app as runtime_app
from tests.base import AsyncMongoTestCase


class AuthApiRouteTests(AsyncMongoTestCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.app = runtime_app
        self.app.dependency_overrides[get_database] = lambda: self.database
        self.http_client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app),
            base_url="http://testserver",
        )

    async def asyncTearDown(self):
        await self.http_client.aclose()
        self.app.dependency_overrides.clear()
        await super().asyncTearDown()

    async def test_account_bootstrap_register_login_logout_and_check_auth(self):
        check_account_before = await self.http_client.get("/check-account")
        self.assertEqual(check_account_before.status_code, 200)
        self.assertEqual(check_account_before.json(), {"exists": False})

        register_response = await self.http_client.post(
            "/register",
            json={"username": "admin", "password": "supersecret"},
        )
        self.assertEqual(register_response.status_code, 200)
        self.assertTrue(register_response.json()["success"])

        second_register_response = await self.http_client.post(
            "/register",
            json={"username": "admin2", "password": "supersecret"},
        )
        self.assertEqual(second_register_response.status_code, 403)

        login_response = await self.http_client.post(
            "/login",
            json={"username": "admin", "password": "supersecret"},
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.json()["message"], "Login successful")

        check_auth_response = await self.http_client.get("/check-auth")
        self.assertEqual(check_auth_response.status_code, 200)
        self.assertEqual(check_auth_response.json(), {"authenticated": True})

        logout_response = await self.http_client.post("/logout")
        self.assertEqual(logout_response.status_code, 200)
        self.assertEqual(logout_response.json()["message"], "Logout successful")

        check_auth_after_logout = await self.http_client.get("/check-auth")
        self.assertEqual(check_auth_after_logout.status_code, 401)

    async def test_change_password_updates_credentials(self):
        await self.database["users"].insert_one(
            {
                "username": "admin",
                "hashed_password": get_password_hash("old-password"),
            }
        )

        login_response = await self.http_client.post(
            "/login",
            json={"username": "admin", "password": "old-password"},
        )
        self.assertEqual(login_response.status_code, 200)

        change_password_response = await self.http_client.post(
            "/change-password",
            json={
                "current_password": "old-password",
                "new_password": "new-password-123",
            },
        )
        self.assertEqual(change_password_response.status_code, 200)
        self.assertEqual(
            change_password_response.json()["message"],
            "Password changed successfully",
        )

        await self.http_client.post("/logout")

        old_login_response = await self.http_client.post(
            "/login",
            json={"username": "admin", "password": "old-password"},
        )
        self.assertEqual(old_login_response.status_code, 401)

        new_login_response = await self.http_client.post(
            "/login",
            json={"username": "admin", "password": "new-password-123"},
        )
        self.assertEqual(new_login_response.status_code, 200)

    async def test_nuclei_templates_route_returns_expected_shape(self):
        response = await self.http_client.get("/nuclei/templates")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("template_categories", data)
        self.assertIn("quick_scan", data["template_categories"])
        self.assertIn("severity_levels", data)
        self.assertIn("popular_tags", data)
        self.assertIn("recommendations", data)
