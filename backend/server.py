from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage


# ---------------- Logging ----------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("propflo")


# ---------------- DB ----------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


# ---------------- App / Router ----------------
app = FastAPI(title="PropFlo CRM API")
api = APIRouter(prefix="/api")


# ---------------- Auth helpers ----------------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_DAYS = 7


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


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
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
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


# ---------------- Models ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime


class LeadIn(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    source: str = "Website"  # Website, Referral, Walk-in, Social
    status: str = "New"  # New, Contacted, Qualified, Lost
    temperature: Literal["hot", "warm", "cold"] = "warm"
    budget: Optional[float] = None
    interest: Optional[str] = None  # e.g. "3BHK Apartment in Bandra"
    notes: Optional[str] = None


class Lead(LeadIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_by: Optional[str] = None
    ai_summary: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PropertyIn(BaseModel):
    title: str
    location: str
    price: float
    bedrooms: int = 0
    bathrooms: int = 0
    area_sqft: float = 0
    type: str = "Apartment"  # Apartment, Villa, Plot, Office
    status: str = "Available"  # Available, Sold, Reserved
    image_url: Optional[str] = None
    description: Optional[str] = None


class Property(PropertyIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContactIn(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    type: str = "Buyer"  # Buyer, Seller, Tenant, Owner
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


class Deal(DealIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskIn(BaseModel):
    title: str
    type: str = "Call"  # Call, Site Visit, Follow-up, Meeting
    due_at: datetime
    related_to: Optional[str] = None  # lead/contact name
    priority: str = "medium"  # low, medium, high
    completed: bool = False
    notes: Optional[str] = None


class Task(TaskIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------- Auth endpoints ----------------
def _set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_DAYS * 24 * 3600,
        path="/",
    )


@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": data.name,
        "role": "agent",
        "password_hash": hash_password(data.password),
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

    # brute force lockout
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    now = datetime.now(timezone.utc)
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and locked_until > now:
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
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "agent"),
            "created_at": user["created_at"],
        },
    }


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


# ---------------- Dashboard ----------------
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    total_leads = await db.leads.count_documents({})
    hot_leads = await db.leads.count_documents({"temperature": "hot"})
    properties = await db.properties.count_documents({})
    available_props = await db.properties.count_documents({"status": "Available"})
    total_deals = await db.deals.count_documents({})
    won_deals = await db.deals.count_documents({"stage": "Closed Won"})

    # revenue from won deals
    pipeline = [{"$match": {"stage": "Closed Won"}}, {"$group": {"_id": None, "sum": {"$sum": "$value"}}}]
    revenue_doc = await db.deals.aggregate(pipeline).to_list(1)
    revenue = revenue_doc[0]["sum"] if revenue_doc else 0

    pipeline_value = [{"$match": {"stage": {"$nin": ["Closed Won", "Closed Lost"]}}}, {"$group": {"_id": None, "sum": {"$sum": "$value"}}}]
    pv_doc = await db.deals.aggregate(pipeline_value).to_list(1)
    pipeline_total = pv_doc[0]["sum"] if pv_doc else 0

    # leads by stage / temperature
    by_temp = {"hot": hot_leads, "warm": await db.leads.count_documents({"temperature": "warm"}), "cold": await db.leads.count_documents({"temperature": "cold"})}

    # tasks today
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    tasks_today = await db.tasks.count_documents({"due_at": {"$gte": today, "$lt": tomorrow}, "completed": False})

    conversion_rate = round((won_deals / total_deals) * 100, 1) if total_deals else 0

    return {
        "total_leads": total_leads,
        "hot_leads": hot_leads,
        "properties": properties,
        "available_properties": available_props,
        "total_deals": total_deals,
        "won_deals": won_deals,
        "revenue": revenue,
        "pipeline_value": pipeline_total,
        "tasks_today": tasks_today,
        "conversion_rate": conversion_rate,
        "leads_by_temperature": by_temp,
    }


# ---------------- Generic CRUD helpers ----------------
async def _list(coll, sort_field="created_at"):
    cursor = db[coll].find({}, {"_id": 0}).sort(sort_field, -1)
    return await cursor.to_list(1000)


# ---------------- Leads ----------------
@api.get("/leads")
async def list_leads(temperature: Optional[str] = None, status: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if temperature:
        q["temperature"] = temperature
    if status:
        q["status"] = status
    return await db.leads.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/leads")
async def create_lead(data: LeadIn, user=Depends(get_current_user)):
    lead = Lead(**data.dict(), created_by=user["id"])
    await db.leads.insert_one(lead.dict())
    return lead.dict()


@api.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


@api.put("/leads/{lead_id}")
async def update_lead(lead_id: str, data: LeadIn, user=Depends(get_current_user)):
    res = await db.leads.update_one({"id": lead_id}, {"$set": data.dict()})
    if res.matched_count == 0:
        raise HTTPException(404, "Lead not found")
    return await db.leads.find_one({"id": lead_id}, {"_id": 0})


@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user=Depends(get_current_user)):
    await db.leads.delete_one({"id": lead_id})
    return {"ok": True}


@api.post("/leads/{lead_id}/ai-summary")
async def ai_lead_summary(lead_id: str, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(500, "LLM key not configured")

    prompt = (
        f"You are a real estate sales assistant. Generate a concise 3-4 sentence professional summary "
        f"and 2 actionable next-step recommendations for this lead. Be specific and persuasive.\n\n"
        f"Lead: {lead.get('name')}\n"
        f"Source: {lead.get('source')}\n"
        f"Temperature: {lead.get('temperature')}\n"
        f"Status: {lead.get('status')}\n"
        f"Budget: ₹{lead.get('budget') or 'Not specified'}\n"
        f"Interest: {lead.get('interest') or 'Not specified'}\n"
        f"Notes: {lead.get('notes') or 'None'}\n\n"
        f"Format:\nSummary: <one paragraph>\nNext Steps:\n1. <action>\n2. <action>"
    )

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"lead-summary-{lead_id}",
            system_message="You are an expert real estate CRM assistant who writes crisp, actionable summaries.",
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        response = await chat.send_message(UserMessage(text=prompt))
        summary_text = response if isinstance(response, str) else str(response)
        await db.leads.update_one({"id": lead_id}, {"$set": {"ai_summary": summary_text}})
        return {"ai_summary": summary_text}
    except Exception as e:
        logger.exception("AI summary failed")
        raise HTTPException(500, f"AI summary failed: {str(e)}")


# ---------------- Properties ----------------
@api.get("/properties")
async def list_properties(user=Depends(get_current_user)):
    return await _list("properties")


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
    return await _list("contacts")


@api.post("/contacts")
async def create_contact(data: ContactIn, user=Depends(get_current_user)):
    c = Contact(**data.dict())
    await db.contacts.insert_one(c.dict())
    return c.dict()


@api.delete("/contacts/{cid}")
async def delete_contact(cid: str, user=Depends(get_current_user)):
    await db.contacts.delete_one({"id": cid})
    return {"ok": True}


# ---------------- Deals (Pipeline) ----------------
@api.get("/deals")
async def list_deals(user=Depends(get_current_user)):
    return await _list("deals")


@api.post("/deals")
async def create_deal(data: DealIn, user=Depends(get_current_user)):
    if data.stage not in PIPELINE_STAGES:
        raise HTTPException(400, "Invalid stage")
    d = Deal(**data.dict())
    await db.deals.insert_one(d.dict())
    return d.dict()


class StageUpdate(BaseModel):
    stage: str


@api.put("/deals/{did}/stage")
async def update_deal_stage(did: str, body: StageUpdate, user=Depends(get_current_user)):
    if body.stage not in PIPELINE_STAGES:
        raise HTTPException(400, "Invalid stage")
    res = await db.deals.update_one({"id": did}, {"$set": {"stage": body.stage}})
    if res.matched_count == 0:
        raise HTTPException(404, "Deal not found")
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
    return await db.tasks.find({}, {"_id": 0}).sort("due_at", 1).to_list(1000)


@api.post("/tasks")
async def create_task(data: TaskIn, user=Depends(get_current_user)):
    t = Task(**data.dict())
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


# ---------------- Health ----------------
@api.get("/")
async def root():
    return {"app": "PropFlo CRM", "status": "ok"}


# ---------------- Seeding ----------------
async def seed_users():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pass = os.environ["ADMIN_PASSWORD"]
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "PropFlo Admin",
            "role": "admin",
            "password_hash": hash_password(admin_pass),
            "created_at": datetime.now(timezone.utc),
        })
    if not await db.users.find_one({"email": "agent@propflo.com"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": "agent@propflo.com",
            "name": "Sales Agent",
            "role": "agent",
            "password_hash": hash_password("agent123"),
            "created_at": datetime.now(timezone.utc),
        })


async def seed_demo_data():
    if await db.leads.count_documents({}) > 0:
        return  # already seeded

    now = datetime.now(timezone.utc)

    leads = [
        {"name": "Rohan Mehta", "phone": "+91 98765 43210", "email": "rohan@example.com", "source": "Website", "status": "Contacted", "temperature": "hot", "budget": 12000000, "interest": "3BHK Apartment in Bandra West", "notes": "Wants sea view, ready to move"},
        {"name": "Priya Sharma", "phone": "+91 98123 45678", "email": "priya@example.com", "source": "Referral", "status": "New", "temperature": "warm", "budget": 8500000, "interest": "2BHK in Andheri", "notes": "First-time buyer, needs home loan"},
        {"name": "Karan Singh", "phone": "+91 90909 80808", "email": "karan@example.com", "source": "Walk-in", "status": "Qualified", "temperature": "hot", "budget": 25000000, "interest": "Villa in Lonavala", "notes": "Weekend home, family of 5"},
        {"name": "Anita Desai", "phone": "+91 99887 66554", "email": "anita@example.com", "source": "Social", "status": "New", "temperature": "cold", "budget": 4500000, "interest": "1BHK in Thane", "notes": "Just browsing"},
        {"name": "Vikram Iyer", "phone": "+91 91234 56780", "email": "vikram@example.com", "source": "Website", "status": "Contacted", "temperature": "warm", "budget": 15000000, "interest": "4BHK Penthouse in Powai", "notes": "Comparing 3 projects"},
        {"name": "Sneha Kapoor", "phone": "+91 98989 77777", "email": "sneha@example.com", "source": "Referral", "status": "Qualified", "temperature": "hot", "budget": 18000000, "interest": "Sea-facing 3BHK in Worli", "notes": "Cash buyer"},
    ]
    for l in leads:
        l["id"] = str(uuid.uuid4())
        l["created_at"] = now - timedelta(days=len(leads))
        l["ai_summary"] = None
        l["created_by"] = None
    await db.leads.insert_many(leads)

    properties = [
        {"title": "Skyline Heights – 3BHK Sea View", "location": "Bandra West, Mumbai", "price": 35000000, "bedrooms": 3, "bathrooms": 3, "area_sqft": 1450, "type": "Apartment", "status": "Available", "image_url": "https://images.unsplash.com/photo-1776500588108-1e059459f14c?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80", "description": "Premium sea-facing apartment with marble flooring, modular kitchen and rooftop pool access."},
        {"title": "Emerald Villa", "location": "Lonavala", "price": 65000000, "bedrooms": 5, "bathrooms": 5, "area_sqft": 5200, "type": "Villa", "status": "Available", "image_url": "https://images.unsplash.com/photo-1766603636483-84b2a2b8ee89?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80", "description": "Hill-view villa with infinity pool, home theatre, and private garden."},
        {"title": "Beige Modern Home", "location": "Pune", "price": 22000000, "bedrooms": 4, "bathrooms": 4, "area_sqft": 3100, "type": "Villa", "status": "Reserved", "image_url": "https://images.unsplash.com/photo-1761347603872-060d6e2debb9?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80", "description": "Contemporary villa with large windows, double-height living room."},
        {"title": "Powai Lake Penthouse", "location": "Powai, Mumbai", "price": 47500000, "bedrooms": 4, "bathrooms": 5, "area_sqft": 2800, "type": "Apartment", "status": "Available", "image_url": "https://images.unsplash.com/photo-1638454795595-0a0abf68614d?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80", "description": "Luxury penthouse with 270° lake view, jacuzzi, and private terrace."},
        {"title": "Andheri Smart 2BHK", "location": "Andheri East, Mumbai", "price": 9500000, "bedrooms": 2, "bathrooms": 2, "area_sqft": 980, "type": "Apartment", "status": "Available", "image_url": "https://images.unsplash.com/photo-1776500588108-1e059459f14c?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80", "description": "Smart-home enabled 2BHK near metro, gym, and clubhouse."},
        {"title": "Thane Garden 1BHK", "location": "Thane West", "price": 5200000, "bedrooms": 1, "bathrooms": 1, "area_sqft": 540, "type": "Apartment", "status": "Available", "image_url": "https://images.unsplash.com/photo-1766603636483-84b2a2b8ee89?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80", "description": "Cosy 1BHK with garden access, ideal first home."},
    ]
    for p in properties:
        p["id"] = str(uuid.uuid4())
        p["created_at"] = now
    await db.properties.insert_many(properties)

    contacts = [
        {"name": "Rohan Mehta", "phone": "+91 98765 43210", "email": "rohan@example.com", "type": "Buyer", "notes": "Hot lead"},
        {"name": "Mr. Shah (Owner)", "phone": "+91 98000 11111", "email": "shah@example.com", "type": "Seller", "notes": "Owns Bandra apartment"},
        {"name": "Neha Joshi", "phone": "+91 91111 22222", "email": "neha@example.com", "type": "Tenant", "notes": "Looking for 1BHK rental"},
        {"name": "Mrs. Kapoor", "phone": "+91 99999 88888", "email": "kapoor@example.com", "type": "Owner", "notes": "Multiple listings"},
    ]
    for c in contacts:
        c["id"] = str(uuid.uuid4())
        c["created_at"] = now
    await db.contacts.insert_many(contacts)

    deals = [
        {"title": "Bandra 3BHK – Mehta", "client_name": "Rohan Mehta", "property_title": "Skyline Heights – 3BHK Sea View", "value": 35000000, "stage": "Negotiation", "expected_close": now + timedelta(days=10), "notes": "Negotiating final price"},
        {"title": "Lonavala Villa – Singh", "client_name": "Karan Singh", "property_title": "Emerald Villa", "value": 65000000, "stage": "Site Visit", "expected_close": now + timedelta(days=21), "notes": "Site visit on Saturday"},
        {"title": "Andheri 2BHK – Sharma", "client_name": "Priya Sharma", "property_title": "Andheri Smart 2BHK", "value": 9500000, "stage": "Contacted", "expected_close": now + timedelta(days=30), "notes": "Sent brochures"},
        {"title": "Powai Penthouse – Iyer", "client_name": "Vikram Iyer", "property_title": "Powai Lake Penthouse", "value": 47500000, "stage": "New", "expected_close": now + timedelta(days=45), "notes": "Initial enquiry"},
        {"title": "Worli 3BHK – Kapoor", "client_name": "Sneha Kapoor", "property_title": "Skyline Heights – 3BHK Sea View", "value": 38000000, "stage": "Closed Won", "expected_close": now - timedelta(days=2), "notes": "Token received"},
        {"title": "Thane 1BHK – Desai", "client_name": "Anita Desai", "property_title": "Thane Garden 1BHK", "value": 5200000, "stage": "Closed Lost", "expected_close": now - timedelta(days=5), "notes": "Went with competitor"},
    ]
    for d in deals:
        d["id"] = str(uuid.uuid4())
        d["created_at"] = now
    await db.deals.insert_many(deals)

    tasks = [
        {"title": "Call Rohan Mehta for follow-up", "type": "Call", "due_at": now + timedelta(hours=2), "related_to": "Rohan Mehta", "priority": "high", "completed": False, "notes": "Confirm site visit"},
        {"title": "Site visit at Emerald Villa", "type": "Site Visit", "due_at": now + timedelta(days=1), "related_to": "Karan Singh", "priority": "high", "completed": False, "notes": "Carry brochure"},
        {"title": "Send loan documents to Priya", "type": "Follow-up", "due_at": now + timedelta(days=2), "related_to": "Priya Sharma", "priority": "medium", "completed": False, "notes": None},
        {"title": "Meeting with Mr. Shah (owner)", "type": "Meeting", "due_at": now + timedelta(days=3), "related_to": "Mr. Shah", "priority": "medium", "completed": False, "notes": None},
        {"title": "WhatsApp Vikram brochure pdf", "type": "Follow-up", "due_at": now - timedelta(hours=4), "related_to": "Vikram Iyer", "priority": "low", "completed": True, "notes": "Done"},
    ]
    for t in tasks:
        t["id"] = str(uuid.uuid4())
        t["created_at"] = now
    await db.tasks.insert_many(tasks)

    logger.info("Seeded demo data")


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
    logger.info("PropFlo backend ready")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ---------------- Mount ----------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
