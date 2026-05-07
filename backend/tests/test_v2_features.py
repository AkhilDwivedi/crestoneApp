"""Crestone Realty CRM v2: tests for multi-agent visibility, documents, WhatsApp, properties filters, push token."""
import os
import base64
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://realty-connect-113.preview.emergentagent.com",
).rstrip("/")
ADMIN_EMAIL = "admin@propflo.com"
ADMIN_PASSWORD = "admin123"
AGENT_EMAIL = "agent@crestone.com"
AGENT_PASSWORD = "agent123"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    if r.status_code == 429:
        pytest.skip("rate limited")
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    j = r.json()
    return j["access_token"], j["user"]


@pytest.fixture(scope="session")
def admin_ctx():
    tok, user = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return {"token": tok, "user": user, "headers": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}}


@pytest.fixture(scope="session")
def agent_ctx():
    tok, user = _login(AGENT_EMAIL, AGENT_PASSWORD)
    return {"token": tok, "user": user, "headers": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}}


# --- WhatsApp templates ---
class TestWhatsAppTemplates:
    def test_returns_six_templates(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/whatsapp/templates", headers=admin_ctx["headers"], timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 6
        for t in data:
            for k in ["id", "title", "icon", "template"]:
                assert k in t, f"missing {k} in template {t}"
            assert isinstance(t["template"], str) and len(t["template"]) > 10
        ids = {t["id"] for t in data}
        assert {"intro", "brochure", "site_visit", "followup", "offer", "congratulations"} <= ids

    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/whatsapp/templates", timeout=15)
        assert r.status_code == 401


# --- Users visibility ---
class TestUsersVisibility:
    def test_admin_sees_all(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/users", headers=admin_ctx["headers"], timeout=15)
        assert r.status_code == 200
        users = r.json()
        emails = {u["email"] for u in users}
        assert ADMIN_EMAIL in emails
        assert AGENT_EMAIL in emails
        assert len(users) >= 2
        # sanity: no _id, no password_hash
        for u in users:
            assert "_id" not in u
            assert "password_hash" not in u

    def test_agent_sees_only_self(self, agent_ctx):
        r = requests.get(f"{BASE_URL}/api/users", headers=agent_ctx["headers"], timeout=15)
        assert r.status_code == 200
        users = r.json()
        assert len(users) == 1
        assert users[0]["email"] == AGENT_EMAIL


# --- Lead visibility & assignment ---
class TestLeadVisibilityAndAssign:
    def test_admin_sees_all_leads(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/leads", headers=admin_ctx["headers"], timeout=15)
        assert r.status_code == 200
        leads = r.json()
        assert len(leads) >= 6
        # at least one assigned to admin and one to agent expected per seed
        assigned_set = {l.get("assigned_to") for l in leads}
        assert len(assigned_set) >= 2

    def test_agent_sees_only_assigned(self, agent_ctx):
        r = requests.get(f"{BASE_URL}/api/leads", headers=agent_ctx["headers"], timeout=15)
        assert r.status_code == 200
        leads = r.json()
        agent_id = agent_ctx["user"]["id"]
        for l in leads:
            assigned = l.get("assigned_to")
            assert assigned in (agent_id, None), f"agent should not see lead assigned to {assigned}"

    def test_agent_cannot_assign(self, admin_ctx, agent_ctx):
        # pick any lead via admin
        r = requests.get(f"{BASE_URL}/api/leads", headers=admin_ctx["headers"], timeout=15)
        lead_id = r.json()[0]["id"]
        ru = requests.put(f"{BASE_URL}/api/leads/{lead_id}/assign",
                          headers=agent_ctx["headers"], json={"assigned_to": agent_ctx["user"]["id"]}, timeout=15)
        assert ru.status_code == 403

    def test_admin_assigns_lead(self, admin_ctx, agent_ctx):
        # create a fresh lead so we can mutate freely
        payload = {"name": "TEST_AssignLead", "phone": "+91 90000 11111",
                   "source": "Website", "status": "New", "temperature": "warm"}
        rc = requests.post(f"{BASE_URL}/api/leads", headers=admin_ctx["headers"], json=payload, timeout=15)
        assert rc.status_code == 200
        lead_id = rc.json()["id"]
        try:
            agent_id = agent_ctx["user"]["id"]
            ra = requests.put(f"{BASE_URL}/api/leads/{lead_id}/assign",
                              headers=admin_ctx["headers"], json={"assigned_to": agent_id}, timeout=15)
            assert ra.status_code == 200
            assert ra.json()["assigned_to"] == agent_id
            # verify with GET
            rg = requests.get(f"{BASE_URL}/api/leads/{lead_id}", headers=admin_ctx["headers"], timeout=15)
            assert rg.status_code == 200 and rg.json()["assigned_to"] == agent_id
        finally:
            requests.delete(f"{BASE_URL}/api/leads/{lead_id}", headers=admin_ctx["headers"], timeout=15)


# --- Documents on leads ---
class TestLeadDocuments:
    def _create_lead(self, ctx):
        r = requests.post(f"{BASE_URL}/api/leads", headers=ctx["headers"],
                          json={"name": "TEST_DocLead", "phone": "+91 90000 22222",
                                "source": "Website", "status": "New", "temperature": "warm"},
                          timeout=15)
        assert r.status_code == 200
        return r.json()["id"]

    def test_add_list_get_delete(self, admin_ctx):
        lead_id = self._create_lead(admin_ctx)
        try:
            content = base64.b64encode(b"hello world test pdf").decode()
            payload = {"name": "TEST_aadhaar.pdf", "doc_type": "aadhaar",
                       "content_base64": content, "mime_type": "application/pdf"}
            rp = requests.post(f"{BASE_URL}/api/leads/{lead_id}/documents",
                               headers=admin_ctx["headers"], json=payload, timeout=15)
            assert rp.status_code == 200, rp.text
            doc = rp.json()
            assert doc["name"] == "TEST_aadhaar.pdf"
            assert doc["content_base64"] is None  # stripped in response
            doc_id = doc["id"]

            # list
            rl = requests.get(f"{BASE_URL}/api/leads/{lead_id}/documents",
                              headers=admin_ctx["headers"], timeout=15)
            assert rl.status_code == 200
            docs = rl.json()
            assert any(d["id"] == doc_id for d in docs)
            for d in docs:
                assert "content_base64" not in d  # excluded in list view

            # full doc
            rg = requests.get(f"{BASE_URL}/api/leads/{lead_id}/documents/{doc_id}",
                              headers=admin_ctx["headers"], timeout=15)
            assert rg.status_code == 200
            full = rg.json()
            assert full["content_base64"] == content
            assert full["mime_type"] == "application/pdf"

            # delete
            rd = requests.delete(f"{BASE_URL}/api/leads/{lead_id}/documents/{doc_id}",
                                 headers=admin_ctx["headers"], timeout=15)
            assert rd.status_code == 200
            rg2 = requests.get(f"{BASE_URL}/api/leads/{lead_id}/documents/{doc_id}",
                               headers=admin_ctx["headers"], timeout=15)
            assert rg2.status_code == 404
        finally:
            requests.delete(f"{BASE_URL}/api/leads/{lead_id}", headers=admin_ctx["headers"], timeout=15)

    def test_oversized_returns_413(self, admin_ctx):
        lead_id = self._create_lead(admin_ctx)
        try:
            big = "A" * 4_600_000  # > 4.5M cap
            payload = {"name": "big.bin", "doc_type": "other", "content_base64": big}
            rp = requests.post(f"{BASE_URL}/api/leads/{lead_id}/documents",
                               headers=admin_ctx["headers"], json=payload, timeout=30)
            assert rp.status_code == 413, f"expected 413 got {rp.status_code}"
        finally:
            requests.delete(f"{BASE_URL}/api/leads/{lead_id}", headers=admin_ctx["headers"], timeout=15)


# --- Properties search/filter ---
class TestPropertiesFilter:
    def test_search_gurgaon(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/properties",
                         headers=admin_ctx["headers"],
                         params={"search": "Gurgaon"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for p in data:
            blob = f"{p.get('title','')} {p.get('location','')} {p.get('description','')}".lower()
            assert "gurgaon" in blob

    def test_search_and_min_price(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/properties",
                         headers=admin_ctx["headers"],
                         params={"search": "Gurgaon", "min_price": 10000000}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        for p in data:
            assert p["price"] >= 10000000

    def test_seeded_count_eight(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/properties", headers=admin_ctx["headers"], timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 8, f"expected 8 seeded properties, got {len(data)}"
        # Gurgaon/Noida/Delhi locations represented
        locs = " ".join(p.get("location", "") for p in data).lower()
        for city in ("gurgaon", "noida", "delhi"):
            assert city in locs, f"{city} not in seeded locations"

    def test_type_filter(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/properties",
                         headers=admin_ctx["headers"], params={"type": "Villa"}, timeout=15)
        assert r.status_code == 200
        for p in r.json():
            assert p["type"] == "Villa"


# --- Push token ---
class TestPushToken:
    def test_save_token(self, agent_ctx):
        token = f"ExponentPushToken[TEST_{uuid.uuid4().hex[:10]}]"
        r = requests.post(f"{BASE_URL}/api/auth/push-token",
                          headers=agent_ctx["headers"], json={"expo_push_token": token}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# --- Seed sanity ---
class TestSeedCounts:
    def test_seed_data_counts(self, admin_ctx):
        h = admin_ctx["headers"]
        leads = requests.get(f"{BASE_URL}/api/leads", headers=h, timeout=15).json()
        props = requests.get(f"{BASE_URL}/api/properties", headers=h, timeout=15).json()
        deals = requests.get(f"{BASE_URL}/api/deals", headers=h, timeout=15).json()
        contacts = requests.get(f"{BASE_URL}/api/contacts", headers=h, timeout=15).json()
        tasks = requests.get(f"{BASE_URL}/api/tasks", headers=h, timeout=15).json()
        assert len(leads) >= 6
        assert len(props) >= 8
        assert len(deals) >= 6
        assert len(contacts) >= 4
        assert len(tasks) >= 5
