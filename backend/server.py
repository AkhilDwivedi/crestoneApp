from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import asyncio
import bcrypt
import jwt as pyjwt
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("crestone")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Crestone Realty CRM API")
api = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_DAYS = 7
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


# ---------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_DAYS),
        "type": "access",
    }
    return pyjwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def is_admin(user: dict) -> bool:
    return user.get("role") == "admin"


def visibility_filter(user: dict, field: str = "assigned_to") -> dict:
    """Returns Mongo filter scoped to user (admins see all, agents see only assigned)."""
    if is_admin(user):
        return {}
    return {"$or": [{field: user["id"]}, {field: None}, {field: {"$exists": False}}]}


# ---------------- Models ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PushTokenIn(BaseModel):
    expo_push_token: str


class LeadIn(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    source: str = "Website"
    status: str = "New"
    temperature: Literal["hot", "warm", "cold"] = "warm"
    budget: Optional[float] = None
    interest: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None  # user id


class Lead(LeadIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_by: Optional[str] = None
    ai_summary: Optional[str] = None
    documents: List[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PropertyIn(BaseModel):
    title: str
    location: str
    price: float
    bedrooms: int = 0
    bathrooms: int = 0
    area_sqft: float = 0
    type: str = "Apartment"
    status: str = "Available"
    image_url: Optional[str] = None
    description: Optional[str] = None


class Property(PropertyIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContactIn(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    type: str = "Buyer"
    notes: Optional[str] = None


class Contact(ContactIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


PIPELINE_STAGES = ["New", "Contacted", "Site Visit", "Negotiation", "Closed Won", "Closed Lost"]


class DealIn(BaseModel):
    title: str
    client_name: str
    property_title: Optional[str] = None
    value: float = 0
    stage: str = "New"
    expected_close: Optional[datetime] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None


class Deal(DealIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskIn(BaseModel):
    title: str
    type: str = "Call"
    due_at: datetime
    related_to: Optional[str] = None
    priority: str = "medium"
    completed: bool = False
    notes: Optional[str] = None
    assigned_to: Optional[str] = None


class Task(TaskIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DocumentIn(BaseModel):
    name: str
    doc_type: str  # "aadhaar", "pan", "agreement", "other"
    content_base64: str
    mime_type: str = "application/octet-stream"


class AssignIn(BaseModel):
    assigned_to: Optional[str] = None  # user id or null to unassign


class StageUpdate(BaseModel):
    stage: str


# ---------------- Auth ----------------
def _set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=False,
        samesite="lax", max_age=ACCESS_TOKEN_DAYS * 24 * 3600, path="/",
    )


@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id, "email": email, "name": data.name, "role": "agent",
        "password_hash": hash_password(data.password), "expo_push_token": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    _set_auth_cookie(response, token)
    return {
        "access_token": token,
        "user": {"id": user_id, "email": email, "name": data.name, "role": "agent", "created_at": doc["created_at"]},
    }


@api.post("/auth/login")
async def login(data: LoginIn, request: Request, response: Response):
    email = data.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    now = datetime.now(timezone.utc)

    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        if attempt.get("locked_until") and attempt["locked_until"] > now:
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": now + timedelta(minutes=15)}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": identifier})
    token = create_access_token(user["id"], email)
    _set_auth_cookie(response, token)
    return {
        "access_token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user["name"],
                 "role": user.get("role", "agent"), "created_at": user["created_at"]},
    }


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.post("/auth/push-token")
async def register_push_token(data: PushTokenIn, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"expo_push_token": data.expo_push_token}})
    return {"ok": True}


# ---------------- Users (admin) ----------------
@api.get("/users")
async def list_users(user=Depends(get_current_user)):
    """List all users (for admin to assign leads). Agents see only themselves."""
    if not is_admin(user):
        return [{"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}]
    users = await db.users.find({}, {"_id": 0, "password_hash": 0, "expo_push_token": 0}).to_list(1000)
    return users


# ---------------- Dashboard ----------------
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    f = visibility_filter(user)
    total_leads = await db.leads.count_documents(f)
    hot_leads = await db.leads.count_documents({**f, "temperature": "hot"})
    properties = await db.properties.count_documents({})
    available_props = await db.properties.count_documents({"status": "Available"})
    total_deals = await db.deals.count_documents(f)
    won_deals = await db.deals.count_documents({**f, "stage": "Closed Won"})

    revenue_doc = await db.deals.aggregate(
        [{"$match": {**f, "stage": "Closed Won"}}, {"$group": {"_id": None, "sum": {"$sum": "$value"}}}]
    ).to_list(1)
    revenue = revenue_doc[0]["sum"] if revenue_doc else 0

    pv_doc = await db.deals.aggregate(
        [{"$match": {**f, "stage": {"$nin": ["Closed Won", "Closed Lost"]}}},
         {"$group": {"_id": None, "sum": {"$sum": "$value"}}}]
    ).to_list(1)
    pipeline_total = pv_doc[0]["sum"] if pv_doc else 0

    by_temp = {
        "hot": hot_leads,
        "warm": await db.leads.count_documents({**f, "temperature": "warm"}),
        "cold": await db.leads.count_documents({**f, "temperature": "cold"}),
    }

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    tasks_today = await db.tasks.count_documents({**f, "due_at": {"$gte": today, "$lt": tomorrow}, "completed": False})

    conversion_rate = round((won_deals / total_deals) * 100, 1) if total_deals else 0

    return {
        "total_leads": total_leads, "hot_leads": hot_leads,
        "properties": properties, "available_properties": available_props,
        "total_deals": total_deals, "won_deals": won_deals,
        "revenue": revenue, "pipeline_value": pipeline_total,
        "tasks_today": tasks_today, "conversion_rate": conversion_rate,
        "leads_by_temperature": by_temp,
    }


# ---------------- Leads ----------------
@api.get("/leads")
async def list_leads(temperature: Optional[str] = None, status: Optional[str] = None,
                     user=Depends(get_current_user)):
    q = visibility_filter(user)
    if temperature:
        q["temperature"] = temperature
    if status:
        q["status"] = status
    return await db.leads.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/leads")
async def create_lead(data: LeadIn, user=Depends(get_current_user)):
    payload = data.dict()
    if not payload.get("assigned_to"):
        payload["assigned_to"] = user["id"]
    lead = Lead(**payload, created_by=user["id"])
    await db.leads.insert_one(lead.dict())
    return lead.dict()


async def _get_lead_or_404(lead_id: str, user: dict) -> dict:
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if not is_admin(user) and lead.get("assigned_to") and lead["assigned_to"] != user["id"]:
        raise HTTPException(403, "Not your lead")
    return lead


@api.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user=Depends(get_current_user)):
    return await _get_lead_or_404(lead_id, user)


@api.put("/leads/{lead_id}")
async def update_lead(lead_id: str, data: LeadIn, user=Depends(get_current_user)):
    await _get_lead_or_404(lead_id, user)
    await db.leads.update_one({"id": lead_id}, {"$set": data.dict()})
    return await db.leads.find_one({"id": lead_id}, {"_id": 0})


@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user=Depends(get_current_user)):
    await _get_lead_or_404(lead_id, user)
    await db.leads.delete_one({"id": lead_id})
    return {"ok": True}


@api.put("/leads/{lead_id}/assign")
async def assign_lead(lead_id: str, data: AssignIn, user=Depends(get_current_user)):
    if not is_admin(user):
        raise HTTPException(403, "Only admins can reassign leads")
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    await db.leads.update_one({"id": lead_id}, {"$set": {"assigned_to": data.assigned_to}})
    # Send push notification to new assignee
    if data.assigned_to:
        target = await db.users.find_one({"id": data.assigned_to})
        if target and target.get("expo_push_token"):
            asyncio.create_task(send_push(
                [target["expo_push_token"]],
                "New lead assigned 🎯",
                f"{lead['name']} — {lead.get('interest') or lead.get('source', '')}",
                {"url": f"/lead/{lead_id}"},
            ))
    return await db.leads.find_one({"id": lead_id}, {"_id": 0})


@api.post("/leads/{lead_id}/ai-summary")
async def ai_lead_summary(lead_id: str, user=Depends(get_current_user)):
    lead = await _get_lead_or_404(lead_id, user)
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(500, "LLM key not configured")

    prompt = (
        f"You are a real estate sales assistant for Crestone Realty. Generate a concise 3-4 sentence "
        f"professional summary and 2 actionable next-step recommendations for this lead.\n\n"
        f"Lead: {lead.get('name')}\nSource: {lead.get('source')}\nTemperature: {lead.get('temperature')}\n"
        f"Status: {lead.get('status')}\nBudget: ₹{lead.get('budget') or 'Not specified'}\n"
        f"Interest: {lead.get('interest') or 'Not specified'}\nNotes: {lead.get('notes') or 'None'}\n\n"
        f"Format:\nSummary: <one paragraph>\nNext Steps:\n1. <action>\n2. <action>"
    )

    try:
        chat = LlmChat(
            api_key=api_key, session_id=f"lead-summary-{lead_id}",
            system_message="You are an expert real estate CRM assistant.",
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        response = await chat.send_message(UserMessage(text=prompt))
        summary_text = response if isinstance(response, str) else str(response)
        await db.leads.update_one({"id": lead_id}, {"$set": {"ai_summary": summary_text}})
        return {"ai_summary": summary_text}
    except Exception as e:
        logger.exception("AI summary failed")
        raise HTTPException(500, f"AI summary failed: {str(e)}")


# ---------------- Lead Documents ----------------
@api.post("/leads/{lead_id}/documents")
async def add_document(lead_id: str, data: DocumentIn, user=Depends(get_current_user)):
    await _get_lead_or_404(lead_id, user)
    # ~3 MB base64 = ~4 MB string. Limit raw size.
    if len(data.content_base64) > 4_500_000:
        raise HTTPException(413, "Document too large (max 3 MB)")
    doc = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "doc_type": data.doc_type,
        "content_base64": data.content_base64,
        "mime_type": data.mime_type,
        "size_bytes": len(data.content_base64),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": user["id"],
    }
    await db.leads.update_one({"id": lead_id}, {"$push": {"documents": doc}})
    # return doc without content to keep response light
    return {**doc, "content_base64": None}


@api.get("/leads/{lead_id}/documents")
async def list_documents(lead_id: str, user=Depends(get_current_user)):
    lead = await _get_lead_or_404(lead_id, user)
    docs = lead.get("documents", []) or []
    # strip base64 in list view
    return [{k: v for k, v in d.items() if k != "content_base64"} for d in docs]


@api.get("/leads/{lead_id}/documents/{doc_id}")
async def get_document(lead_id: str, doc_id: str, user=Depends(get_current_user)):
    lead = await _get_lead_or_404(lead_id, user)
    for d in lead.get("documents", []) or []:
        if d.get("id") == doc_id:
            return d
    raise HTTPException(404, "Document not found")


@api.delete("/leads/{lead_id}/documents/{doc_id}")
async def delete_document(lead_id: str, doc_id: str, user=Depends(get_current_user)):
    await _get_lead_or_404(lead_id, user)
    await db.leads.update_one({"id": lead_id}, {"$pull": {"documents": {"id": doc_id}}})
    return {"ok": True}


# ---------------- WhatsApp Templates ----------------
WHATSAPP_TEMPLATES = [
    {
        "id": "intro",
        "title": "Introduction",
        "icon": "hand-right",
        "template": "Hi {name}! This is your real estate consultant from Crestone Realty. Saw your enquiry about {interest}. Would love to help you find your dream property. 🏡",
    },
    {
        "id": "brochure",
        "title": "Send Brochure",
        "icon": "document-text",
        "template": "Hi {name}, sharing the brochure for the property you enquired about — {interest}. Let me know your thoughts and we can schedule a site visit. 🏗️",
    },
    {
        "id": "site_visit",
        "title": "Site Visit Confirm",
        "icon": "location",
        "template": "Hi {name}, confirming our site visit tomorrow for {interest}. I'll meet you at the location. Please carry a valid ID. Looking forward! 📍",
    },
    {
        "id": "followup",
        "title": "Follow-up",
        "icon": "reload",
        "template": "Hi {name}, following up on our conversation about {interest}. Have you had a chance to review the details? Happy to clarify anything or share more options. 🤝",
    },
    {
        "id": "offer",
        "title": "Special Offer",
        "icon": "gift",
        "template": "Hi {name}! Exciting news — we have a limited-time offer on {interest}. Pre-launch pricing + flexible payment plan. Shall I share details? 🎉",
    },
    {
        "id": "congratulations",
        "title": "Closing Congrats",
        "icon": "trophy",
        "template": "Congratulations {name}! 🎊 Your {interest} is officially yours. Welcome to Crestone Realty's family. Reach out anytime if you need anything.",
    },
]


@api.get("/whatsapp/templates")
async def whatsapp_templates(user=Depends(get_current_user)):
    return WHATSAPP_TEMPLATES


# ---------------- Properties ----------------
@api.get("/properties")
async def list_properties(
    search: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    bedrooms: Optional[int] = None,
    user=Depends(get_current_user),
):
    q: dict = {}
    if search:
        q["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if type:
        q["type"] = type
    if status:
        q["status"] = status
    if bedrooms is not None:
        q["bedrooms"] = bedrooms
    if min_price is not None or max_price is not None:
        price_q: dict = {}
        if min_price is not None:
            price_q["$gte"] = min_price
        if max_price is not None:
            price_q["$lte"] = max_price
        q["price"] = price_q
    return await db.properties.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/properties")
async def create_property(data: PropertyIn, user=Depends(get_current_user)):
    p = Property(**data.dict())
    await db.properties.insert_one(p.dict())
    return p.dict()


@api.get("/properties/{pid}")
async def get_property(pid: str, user=Depends(get_current_user)):
    p = await db.properties.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Property not found")
    return p


@api.put("/properties/{pid}")
async def update_property(pid: str, data: PropertyIn, user=Depends(get_current_user)):
    res = await db.properties.update_one({"id": pid}, {"$set": data.dict()})
    if res.matched_count == 0:
        raise HTTPException(404, "Property not found")
    return await db.properties.find_one({"id": pid}, {"_id": 0})


@api.delete("/properties/{pid}")
async def delete_property(pid: str, user=Depends(get_current_user)):
    await db.properties.delete_one({"id": pid})
    return {"ok": True}


# ---------------- Contacts ----------------
@api.get("/contacts")
async def list_contacts(user=Depends(get_current_user)):
    return await db.contacts.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/contacts")
async def create_contact(data: ContactIn, user=Depends(get_current_user)):
    c = Contact(**data.dict())
    await db.contacts.insert_one(c.dict())
    return c.dict()


@api.delete("/contacts/{cid}")
async def delete_contact(cid: str, user=Depends(get_current_user)):
    await db.contacts.delete_one({"id": cid})
    return {"ok": True}


# ---------------- Deals ----------------
@api.get("/deals")
async def list_deals(user=Depends(get_current_user)):
    return await db.deals.find(visibility_filter(user), {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/deals")
async def create_deal(data: DealIn, user=Depends(get_current_user)):
    if data.stage not in PIPELINE_STAGES:
        raise HTTPException(400, "Invalid stage")
    payload = data.dict()
    if not payload.get("assigned_to"):
        payload["assigned_to"] = user["id"]
    d = Deal(**payload)
    await db.deals.insert_one(d.dict())
    return d.dict()


@api.put("/deals/{did}/stage")
async def update_deal_stage(did: str, body: StageUpdate, user=Depends(get_current_user)):
    if body.stage not in PIPELINE_STAGES:
        raise HTTPException(400, "Invalid stage")
    deal = await db.deals.find_one({"id": did}, {"_id": 0})
    if not deal:
        raise HTTPException(404, "Deal not found")
    if not is_admin(user) and deal.get("assigned_to") and deal["assigned_to"] != user["id"]:
        raise HTTPException(403, "Not your deal")
    await db.deals.update_one({"id": did}, {"$set": {"stage": body.stage}})
    return await db.deals.find_one({"id": did}, {"_id": 0})


@api.delete("/deals/{did}")
async def delete_deal(did: str, user=Depends(get_current_user)):
    await db.deals.delete_one({"id": did})
    return {"ok": True}


@api.get("/pipeline/stages")
async def pipeline_stages(user=Depends(get_current_user)):
    return PIPELINE_STAGES


# ---------------- Tasks ----------------
@api.get("/tasks")
async def list_tasks(user=Depends(get_current_user)):
    return await db.tasks.find(visibility_filter(user), {"_id": 0}).sort("due_at", 1).to_list(1000)


@api.post("/tasks")
async def create_task(data: TaskIn, user=Depends(get_current_user)):
    payload = data.dict()
    if not payload.get("assigned_to"):
        payload["assigned_to"] = user["id"]
    t = Task(**payload)
    await db.tasks.insert_one(t.dict())
    return t.dict()


@api.put("/tasks/{tid}/complete")
async def complete_task(tid: str, user=Depends(get_current_user)):
    res = await db.tasks.update_one({"id": tid}, {"$set": {"completed": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "Task not found")
    return await db.tasks.find_one({"id": tid}, {"_id": 0})


@api.delete("/tasks/{tid}")
async def delete_task(tid: str, user=Depends(get_current_user)):
    await db.tasks.delete_one({"id": tid})
    return {"ok": True}


# ---------------- Push Notifications ----------------
async def send_push(tokens: List[str], title: str, body: str, data: Optional[dict] = None):
    """Send push notification via Expo Push API. Best-effort."""
    if not tokens:
        return
    try:
        messages = [
            {
                "to": t, "sound": "default",
                "title": title, "body": body,
                "data": data or {}, "priority": "high",
            }
            for t in tokens if t
        ]
        if not messages:
            return
        async with httpx.AsyncClient(timeout=10) as cli:
            await cli.post(EXPO_PUSH_URL, json=messages,
                           headers={"Accept": "application/json", "Content-Type": "application/json"})
    except Exception as e:
        logger.warning("push send failed: %s", e)


async def overdue_task_checker():
    """Loop that checks every 24 hours for overdue tasks and notifies assignees."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            overdue = await db.tasks.find({"completed": False, "due_at": {"$lt": now}}, {"_id": 0}).to_list(1000)
            by_user: dict = {}
            for t in overdue:
                uid = t.get("assigned_to")
                if uid:
                    by_user.setdefault(uid, []).append(t)
            for uid, tasks in by_user.items():
                u = await db.users.find_one({"id": uid})
                if u and u.get("expo_push_token"):
                    count = len(tasks)
                    await send_push(
                        [u["expo_push_token"]],
                        f"{count} overdue task{'s' if count > 1 else ''} ⏰",
                        f"You have {count} pending task{'s' if count > 1 else ''} that need attention.",
                        {"url": "/tasks"},
                    )
        except Exception as e:
            logger.warning("overdue checker error: %s", e)
        await asyncio.sleep(24 * 3600)  # 1 day


# ---------------- Health ----------------
@api.get("/")
async def root():
    return {"app": "Crestone Realty CRM", "status": "ok"}


# ---------------- Seeding ----------------
async def seed_users():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pass = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_email,
            "name": "Crestone Admin", "role": "admin",
            "password_hash": hash_password(admin_pass),
            "expo_push_token": None,
            "created_at": datetime.now(timezone.utc),
        })
    else:
        # keep password in sync with env (so user can rotate via Railway env vars)
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_pass), "role": "admin"}},
        )

    if not await db.users.find_one({"email": "agent@crestone.com"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": "agent@crestone.com",
            "name": "Demo Agent", "role": "agent",
            "password_hash": hash_password("agent123"),
            "expo_push_token": None,
            "created_at": datetime.now(timezone.utc),
        })


async def seed_demo_data():
    if await db.leads.count_documents({}) > 0:
        return

    now = datetime.now(timezone.utc)
    admin = await db.users.find_one({"role": "admin"})
    agent = await db.users.find_one({"email": "agent@crestone.com"})
    admin_id = admin["id"] if admin else None
    agent_id = agent["id"] if agent else None

    leads = [
        {"name": "Aarav Sharma", "phone": "+91 98765 43210", "email": "aarav@example.com",
         "source": "Website", "status": "Contacted", "temperature": "hot", "budget": 35000000,
         "interest": "4BHK in Golf Course Road, Gurgaon", "notes": "Wants premium project, ready to close in 30 days",
         "assigned_to": agent_id},
        {"name": "Priya Verma", "phone": "+91 98123 45678", "email": "priya@example.com",
         "source": "Referral", "status": "New", "temperature": "warm", "budget": 18000000,
         "interest": "3BHK in Sector 150, Noida", "notes": "First-time buyer, comparing 3 projects",
         "assigned_to": agent_id},
        {"name": "Rahul Khanna", "phone": "+91 90909 80808", "email": "rahul@example.com",
         "source": "Walk-in", "status": "Qualified", "temperature": "hot", "budget": 65000000,
         "interest": "Villa in DLF Phase 5, Gurgaon", "notes": "Family of 6, immediate possession required",
         "assigned_to": agent_id},
        {"name": "Sneha Gupta", "phone": "+91 99887 66554", "email": "sneha@example.com",
         "source": "Social", "status": "New", "temperature": "cold", "budget": 7500000,
         "interest": "1BHK in Dwarka, Delhi", "notes": "Just browsing, budget conscious",
         "assigned_to": agent_id},
        {"name": "Vikram Malhotra", "phone": "+91 91234 56780", "email": "vikram@example.com",
         "source": "Website", "status": "Contacted", "temperature": "warm", "budget": 25000000,
         "interest": "3BHK Penthouse in Noida Expressway", "notes": "Wants higher floor, river view",
         "assigned_to": agent_id},
        {"name": "Ananya Kapoor", "phone": "+91 98989 77777", "email": "ananya@example.com",
         "source": "Referral", "status": "Qualified", "temperature": "hot", "budget": 45000000,
         "interest": "4BHK in Greater Kailash, Delhi", "notes": "Cash buyer, prefers ready-to-move",
         "assigned_to": admin_id},
    ]
    for l in leads:
        l["id"] = str(uuid.uuid4())
        l["created_at"] = now - timedelta(days=2)
        l["ai_summary"] = None
        l["created_by"] = admin_id
        l["documents"] = []
    await db.leads.insert_many(leads)

    properties = [
        {"title": "DLF The Crest – 4BHK Premium", "location": "Golf Course Road, Gurgaon",
         "price": 42000000, "bedrooms": 4, "bathrooms": 4, "area_sqft": 3200, "type": "Apartment",
         "status": "Available",
         "image_url": "https://images.unsplash.com/photo-1776500588108-1e059459f14c?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
         "description": "Ultra-luxury 4BHK with private elevator, sky lounge access, and panoramic golf course views."},
        {"title": "Lodha Bellagio Villa", "location": "DLF Phase 5, Gurgaon",
         "price": 75000000, "bedrooms": 5, "bathrooms": 6, "area_sqft": 6500, "type": "Villa",
         "status": "Available",
         "image_url": "https://images.unsplash.com/photo-1766603636483-84b2a2b8ee89?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
         "description": "Standalone villa with infinity pool, home theatre, smart-home automation, and private garden."},
        {"title": "ATS Picturesque Reprieves", "location": "Sector 152, Noida",
         "price": 19500000, "bedrooms": 3, "bathrooms": 3, "area_sqft": 1850, "type": "Apartment",
         "status": "Available",
         "image_url": "https://images.unsplash.com/photo-1761347603872-060d6e2debb9?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
         "description": "Modern 3BHK overlooking 17-acre central park, with clubhouse, gym and rooftop pool."},
        {"title": "Jaypee Greens Penthouse", "location": "Noida Expressway",
         "price": 28000000, "bedrooms": 4, "bathrooms": 5, "area_sqft": 2900, "type": "Apartment",
         "status": "Available",
         "image_url": "https://images.unsplash.com/photo-1638454795595-0a0abf68614d?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
         "description": "Sky-penthouse with 270° view, private terrace garden, and dedicated double-car parking."},
        {"title": "Greater Kailash Builder Floor", "location": "GK-1, South Delhi",
         "price": 48000000, "bedrooms": 4, "bathrooms": 4, "area_sqft": 2400, "type": "Apartment",
         "status": "Reserved",
         "image_url": "https://images.unsplash.com/photo-1776500588108-1e059459f14c?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
         "description": "Full-floor independent builder unit, modular kitchen, servant quarters, lift access."},
        {"title": "Dwarka Smart Home", "location": "Sector 22, Dwarka, Delhi",
         "price": 8200000, "bedrooms": 1, "bathrooms": 1, "area_sqft": 620, "type": "Apartment",
         "status": "Available",
         "image_url": "https://images.unsplash.com/photo-1766603636483-84b2a2b8ee89?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
         "description": "Smart-home enabled 1BHK, walking distance to metro, fully furnished optional."},
        {"title": "Sushant Lok Plot", "location": "Sushant Lok Phase 1, Gurgaon",
         "price": 95000000, "bedrooms": 0, "bathrooms": 0, "area_sqft": 4500, "type": "Plot",
         "status": "Available",
         "image_url": "https://images.unsplash.com/photo-1761347603872-060d6e2debb9?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
         "description": "Premium plot in gated community, all approvals in place, ready for construction."},
        {"title": "Cyber City Office Space", "location": "DLF Cyber City, Gurgaon",
         "price": 32000000, "bedrooms": 0, "bathrooms": 2, "area_sqft": 1800, "type": "Office",
         "status": "Available",
         "image_url": "https://images.unsplash.com/photo-1638454795595-0a0abf68614d?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
         "description": "Fully fitted Grade-A office on 14th floor with city view, 25 workstations, conference rooms."},
    ]
    for p in properties:
        p["id"] = str(uuid.uuid4())
        p["created_at"] = now
    await db.properties.insert_many(properties)

    contacts = [
        {"name": "Aarav Sharma", "phone": "+91 98765 43210", "email": "aarav@example.com",
         "type": "Buyer", "notes": "Hot lead — Gurgaon"},
        {"name": "Mr. Khurana (Owner)", "phone": "+91 98000 11111", "email": "khurana@example.com",
         "type": "Seller", "notes": "Owns GK-1 builder floor"},
        {"name": "Neha Joshi", "phone": "+91 91111 22222", "email": "neha@example.com",
         "type": "Tenant", "notes": "Looking for 1BHK rental in Dwarka"},
        {"name": "Mrs. Bhalla", "phone": "+91 99999 88888", "email": "bhalla@example.com",
         "type": "Owner", "notes": "Multiple listings in Noida"},
    ]
    for c in contacts:
        c["id"] = str(uuid.uuid4())
        c["created_at"] = now
    await db.contacts.insert_many(contacts)

    deals = [
        {"title": "Gurgaon 4BHK – Sharma", "client_name": "Aarav Sharma",
         "property_title": "DLF The Crest – 4BHK Premium", "value": 42000000,
         "stage": "Negotiation", "expected_close": now + timedelta(days=10),
         "notes": "Negotiating final price + parking", "assigned_to": agent_id},
        {"title": "DLF Villa – Khanna", "client_name": "Rahul Khanna",
         "property_title": "Lodha Bellagio Villa", "value": 75000000,
         "stage": "Site Visit", "expected_close": now + timedelta(days=21),
         "notes": "Site visit on Saturday", "assigned_to": agent_id},
        {"title": "Noida 3BHK – Verma", "client_name": "Priya Verma",
         "property_title": "ATS Picturesque Reprieves", "value": 19500000,
         "stage": "Contacted", "expected_close": now + timedelta(days=30),
         "notes": "Sent brochures + payment plan", "assigned_to": agent_id},
        {"title": "Penthouse – Malhotra", "client_name": "Vikram Malhotra",
         "property_title": "Jaypee Greens Penthouse", "value": 28000000,
         "stage": "New", "expected_close": now + timedelta(days=45),
         "notes": "Initial enquiry", "assigned_to": agent_id},
        {"title": "GK Floor – Kapoor", "client_name": "Ananya Kapoor",
         "property_title": "Greater Kailash Builder Floor", "value": 48000000,
         "stage": "Closed Won", "expected_close": now - timedelta(days=2),
         "notes": "Token received, registry next week", "assigned_to": admin_id},
        {"title": "Dwarka 1BHK – Gupta", "client_name": "Sneha Gupta",
         "property_title": "Dwarka Smart Home", "value": 8200000,
         "stage": "Closed Lost", "expected_close": now - timedelta(days=5),
         "notes": "Went with competitor", "assigned_to": agent_id},
    ]
    for d in deals:
        d["id"] = str(uuid.uuid4())
        d["created_at"] = now
    await db.deals.insert_many(deals)

    tasks = [
        {"title": "Call Aarav Sharma — Gurgaon 4BHK", "type": "Call",
         "due_at": now + timedelta(hours=2), "related_to": "Aarav Sharma",
         "priority": "high", "completed": False, "notes": "Confirm site visit",
         "assigned_to": agent_id},
        {"title": "Site visit at Lodha Bellagio Villa", "type": "Site Visit",
         "due_at": now + timedelta(days=1), "related_to": "Rahul Khanna",
         "priority": "high", "completed": False, "notes": "Carry brochure + RERA docs",
         "assigned_to": agent_id},
        {"title": "Send loan documents to Priya", "type": "Follow-up",
         "due_at": now + timedelta(days=2), "related_to": "Priya Verma",
         "priority": "medium", "completed": False, "notes": None,
         "assigned_to": agent_id},
        {"title": "Meeting with Mr. Khurana (owner)", "type": "Meeting",
         "due_at": now + timedelta(days=3), "related_to": "Mr. Khurana",
         "priority": "medium", "completed": False, "notes": None,
         "assigned_to": admin_id},
        {"title": "WhatsApp Vikram brochure pdf", "type": "Follow-up",
         "due_at": now - timedelta(hours=4), "related_to": "Vikram Malhotra",
         "priority": "low", "completed": True, "notes": "Done",
         "assigned_to": agent_id},
    ]
    for t in tasks:
        t["id"] = str(uuid.uuid4())
        t["created_at"] = now
    await db.tasks.insert_many(tasks)

    logger.info("Seeded Crestone demo data (Delhi NCR / Gurgaon / Noida)")


# ---------------- Startup ----------------
@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.leads.create_index("id", unique=True)
        await db.properties.create_index("id", unique=True)
        await db.contacts.create_index("id", unique=True)
        await db.deals.create_index("id", unique=True)
        await db.tasks.create_index("id", unique=True)
    except Exception as e:
        logger.warning("Index creation skipped: %s", e)
    await seed_users()
    await seed_demo_data()
    asyncio.create_task(overdue_task_checker())
    logger.info("Crestone backend ready")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
