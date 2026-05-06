"""PropFlo CRM backend API tests (pytest)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://realty-connect-113.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@propflo.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                     timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# --- Health ---
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# --- Auth ---
class TestAuth:
    def test_login_admin(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "access_token" in d and isinstance(d["access_token"], str)
        assert d["user"]["email"] == ADMIN_EMAIL
        assert d["user"]["role"] == "admin"

    def test_login_invalid(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"email": ADMIN_EMAIL, "password": "wrongpass_xyz"}, timeout=30)
        assert r.status_code in (401, 429)

    def test_register_new_and_duplicate(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r1 = session.post(f"{BASE_URL}/api/auth/register",
                          json={"email": email, "password": "Passw0rd!", "name": "TEST User"}, timeout=30)
        assert r1.status_code == 200, r1.text
        assert r1.json()["user"]["email"] == email
        r2 = session.post(f"{BASE_URL}/api/auth/register",
                          json={"email": email, "password": "Passw0rd!", "name": "TEST User"}, timeout=30)
        assert r2.status_code == 400

    def test_me_with_token(self, session, auth_headers):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_without_token(self):
        # Use a brand new session without cookies/headers
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401


# --- Dashboard ---
class TestDashboard:
    def test_stats(self, session, auth_headers):
        r = session.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_leads", "hot_leads", "revenue", "pipeline_value", "conversion_rate"]:
            assert k in d, f"Missing key {k}"
        assert d["total_leads"] >= 4


# --- Resource lists (seeded) ---
class TestSeededLists:
    @pytest.mark.parametrize("path", ["/api/leads", "/api/properties", "/api/contacts", "/api/deals", "/api/tasks"])
    def test_lists(self, session, auth_headers, path):
        r = session.get(f"{BASE_URL}{path}", headers=auth_headers, timeout=20)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text}"
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 4, f"{path} expected >=4 seeded items, got {len(data)}"
        # ensure no Mongo _id
        if data:
            assert "_id" not in data[0]


# --- Leads CRUD + AI ---
class TestLeadsCRUD:
    def test_full_crud_and_ai(self, session, auth_headers):
        payload = {"name": "TEST_Lead", "phone": "+91 90000 00000",
                   "email": "test_lead@example.com", "source": "Website",
                   "status": "New", "temperature": "hot", "budget": 5000000,
                   "interest": "2BHK in Powai", "notes": "Test note"}
        r = session.post(f"{BASE_URL}/api/leads", headers=auth_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        lead = r.json()
        lid = lead["id"]
        assert lead["name"] == "TEST_Lead"

        # GET
        rg = session.get(f"{BASE_URL}/api/leads/{lid}", headers=auth_headers, timeout=15)
        assert rg.status_code == 200 and rg.json()["id"] == lid

        # PUT
        payload["status"] = "Contacted"
        ru = session.put(f"{BASE_URL}/api/leads/{lid}", headers=auth_headers, json=payload, timeout=15)
        assert ru.status_code == 200 and ru.json()["status"] == "Contacted"

        # AI Summary
        rai = session.post(f"{BASE_URL}/api/leads/{lid}/ai-summary", headers=auth_headers, timeout=90)
        assert rai.status_code == 200, f"AI summary failed: {rai.status_code} {rai.text}"
        assert isinstance(rai.json().get("ai_summary"), str)
        assert len(rai.json()["ai_summary"]) > 20

        # DELETE
        rd = session.delete(f"{BASE_URL}/api/leads/{lid}", headers=auth_headers, timeout=15)
        assert rd.status_code == 200
        rg2 = session.get(f"{BASE_URL}/api/leads/{lid}", headers=auth_headers, timeout=15)
        assert rg2.status_code == 404


# --- Deals stage ---
class TestDealsStage:
    def test_update_stage(self, session, auth_headers):
        r = session.get(f"{BASE_URL}/api/deals", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        deals = r.json()
        assert deals
        did = deals[0]["id"]
        original = deals[0]["stage"]
        new_stage = "Site Visit" if original != "Site Visit" else "Negotiation"
        ru = session.put(f"{BASE_URL}/api/deals/{did}/stage", headers=auth_headers,
                         json={"stage": new_stage}, timeout=15)
        assert ru.status_code == 200
        assert ru.json()["stage"] == new_stage
        # restore
        session.put(f"{BASE_URL}/api/deals/{did}/stage", headers=auth_headers,
                    json={"stage": original}, timeout=15)

    def test_invalid_stage(self, session, auth_headers):
        r = session.get(f"{BASE_URL}/api/deals", headers=auth_headers, timeout=15)
        did = r.json()[0]["id"]
        ru = session.put(f"{BASE_URL}/api/deals/{did}/stage", headers=auth_headers,
                         json={"stage": "NotAStage"}, timeout=15)
        assert ru.status_code == 400


# --- Tasks complete ---
class TestTasks:
    def test_complete(self, session, auth_headers):
        # Create test task
        from datetime import datetime, timezone, timedelta
        due = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        rc = session.post(f"{BASE_URL}/api/tasks", headers=auth_headers,
                          json={"title": "TEST_Task", "type": "Call", "due_at": due,
                                "priority": "low", "completed": False}, timeout=15)
        assert rc.status_code == 200
        tid = rc.json()["id"]
        ru = session.put(f"{BASE_URL}/api/tasks/{tid}/complete", headers=auth_headers, timeout=15)
        assert ru.status_code == 200
        assert ru.json()["completed"] is True
        session.delete(f"{BASE_URL}/api/tasks/{tid}", headers=auth_headers, timeout=15)
