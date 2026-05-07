# Crestone Realty CRM – Mobile App (PRD v2)

## Brand
- **Name:** Crestone Realty
- **Tagline:** Turning Dreams Into Doorways
- **Theme:** Black (`#0A0A0A`) + Gold (`#D4AF55`)
- **Logo:** Gold building emblem, used as app icon, splash, login/register hero
- **Bundle ID:** `com.crestone.realty`

## Goal
A premium dark-themed mobile CRM for real-estate agencies operating in **Delhi NCR / Gurgaon / Noida**. Built as a downloadable APK (Expo + Railway-deployed FastAPI backend + MongoDB Atlas).

## Personas
1. **Sales Agent** (`role=agent`) – manages assigned leads, schedules visits, closes deals.
2. **Sales Admin** (`role=admin`) – sees all leads/deals/tasks, assigns leads to agents, oversees pipeline.

## Tech Stack
- **Frontend:** Expo SDK 54 (Expo Router), React Native, AsyncStorage, axios, expo-notifications, expo-document-picker.
- **Backend:** FastAPI, Motor, bcrypt, PyJWT, emergentintegrations, httpx, asyncio background tasks.
- **DB:** MongoDB Atlas (free M0 tier).
- **Hosting:** Railway (backend), Expo EAS (Android APK).
- **AI:** Emergent LLM key → Anthropic `claude-haiku-4-5-20251001`.

## Features (v2)

### Auth
- JWT register / login / me / logout / push-token (bcrypt, 7-day token, brute-force lockout)
- Push token auto-registers per device on login/launch
- Admin password re-syncs from env vars on every backend restart (so you can rotate via Railway dashboard)

### Multi-agent workspaces ⭐ NEW
- `assigned_to` field on Lead / Deal / Task
- Agents see **only** their assigned items; admin sees all
- Admin-only `PUT /api/leads/{id}/assign` reassigns + sends push to new owner
- "Assigned to" card in lead detail with **Change** action (admin)

### Dashboard
- KPI cards: Total Leads, Hot Leads, Revenue, Pipeline value (scoped by role)
- Lead-temperature horizontal bar
- Recent leads + upcoming tasks
- Conversion %, available properties, today's open tasks

### Leads
- List with Hot / Warm / Cold filter chips + text search
- Detail screen: hero, quick actions (Call / WhatsApp / Email), AI Insights card, **Assign** (admin), Documents, Contact, Requirements
- Full CRUD (with role-based access) + AI summary endpoint

### Properties ⭐ Search added
- List with **inline search** (title, location, description) + type chips (Apartment / Villa / Plot / Office)
- **Advanced filters panel:** min/max price, bedrooms (Any / 1-5 BHK)
- Result count + active-filter dot indicator
- Image-card grid + status badge, detail screen, create/delete

### Pipeline (Kanban)
- 6-stage horizontal board (New → Contacted → Site Visit → Negotiation → Closed Won → Closed Lost)
- Per-stage value totals scoped to user
- Tap-to-move sheet with checkmark on current stage

### Tasks & Follow-ups
- List with priority badges, overdue highlight, tap-to-complete
- Auto push notification daily for overdue tasks per assignee (24-hour loop)

### Documents per Lead ⭐ NEW
- Multiple attachments per lead, base64-stored in MongoDB (3 MB limit)
- Auto-detects type (Aadhaar / PAN / Agreement / Image / Other) from file name
- List view shows name, type badge, size; one-tap delete
- Picker uses `expo-document-picker`

### WhatsApp Templates ⭐ NEW
- 6 ready-to-send templates: Introduction, Send Brochure, Site Visit Confirm, Follow-up, Special Offer, Closing Congrats
- Tap a template → opens WhatsApp deep-link with `{name}` and `{interest}` pre-filled
- Free, no Meta Business approval needed (works for personal & business WhatsApp)

### Push Notifications ⭐ NEW
- Auto-registers Expo push token on login/launch
- **New lead assigned** → instant push to assignee with deep-link `/lead/{id}`
- **Overdue tasks** → daily 24-hour loop counts pending tasks per agent and pushes summary
- Notification channel "default" with high importance, gold accent (#D4AF55)
- ⚠️ Works only on installed APK (not Expo Go / web preview)

### Contacts & More
- Buyer / Seller / Tenant / Owner directory with one-tap call
- Profile / Settings / Sign-out

## Seeded Data (Delhi NCR)
- 6 leads (Gurgaon, Noida, Delhi GK, Dwarka, Sector 150)
- 8 properties: DLF The Crest, Lodha Bellagio Villa, ATS Picturesque, Jaypee Penthouse, GK Builder Floor, Dwarka Smart Home, Sushant Lok Plot, Cyber City Office
- 6 deals across all pipeline stages
- 5 tasks (incl. one overdue, one completed)
- 4 contacts

## API (`/api`)
**Auth:** `register | login | logout | me | push-token`
**Users:** `GET /users` (admin: all, agent: self)
**Dashboard:** `GET /dashboard/stats` (scoped)
**Leads:** `GET (filter) | POST | GET/{id} | PUT | DELETE`, `PUT /{id}/assign` (admin), `POST /{id}/ai-summary`
**Lead Documents:** `GET /{id}/documents`, `POST /{id}/documents`, `GET /{id}/documents/{doc_id}`, `DELETE /{id}/documents/{doc_id}`
**Properties:** full CRUD + query params `search, type, status, min_price, max_price, bedrooms`
**Contacts:** `GET | POST | DELETE`
**Deals:** `GET | POST | DELETE`, `PUT /{id}/stage`
**Tasks:** `GET | POST | DELETE`, `PUT /{id}/complete`
**WhatsApp:** `GET /whatsapp/templates`

## Out of Scope (v3 ideas)
- Real WhatsApp Business API (template approval, auto-send)
- Drag-and-drop kanban (`react-native-reanimated`)
- Google Calendar sync for site visits
- Stripe/Razorpay subscription tiers
- In-app chat between agents
- Document e-sign integration

## Smart Business Hooks
1. **AI Lead Summary** – paid feature wedge for v3 (Free / Pro tiers).
2. **Multi-agent workspaces** – ready to charge per-seat ($X/agent/month).
3. **Lead reassignment + push** – managers stay in control, agents are instantly notified.

## Deployment
- **Backend:** Railway free tier ($5 credit/mo) → `https://*.up.railway.app`
- **Database:** MongoDB Atlas M0 (512 MB free)
- **APK:** Expo EAS Build (`eas build --platform android --profile production`)
- All deployment files included in repo: `Procfile`, `railway.json`, `eas.json`, `BUILD_APK.md`, `DEPLOY_RAILWAY.md`
