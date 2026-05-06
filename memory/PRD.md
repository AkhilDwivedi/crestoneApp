# PropFlo Real Estate CRM – Mobile App (PRD)

## Overview
A premium black + orange Expo (React Native) mobile CRM inspired by PropFlo, built on FastAPI + MongoDB with JWT auth and AI-powered lead insights via the Emergent LLM (Claude Haiku 4.5).

## Goals
- Give real-estate agents a single mobile cockpit for leads, properties, deals, contacts, and tasks.
- Deliver an instantly delightful experience with seeded demo data on first launch.
- Surface revenue & pipeline KPIs prominently to drive daily action.
- Use AI to summarise each lead and recommend next steps.

## Personas
1. **Sales Agent** – Primary user; manages leads, schedules visits, closes deals.
2. **Sales Admin** – Same actions, extra trust level (`role=admin`).

## Tech Stack
- **Frontend:** Expo SDK 54 (Expo Router), React Native, AsyncStorage, axios, @expo/vector-icons.
- **Backend:** FastAPI, Motor (Mongo), bcrypt, PyJWT, emergentintegrations.
- **DB:** MongoDB (`propflo_crm`).
- **AI:** Emergent LLM key → Anthropic `claude-haiku-4-5-20251001`.

## Features (v1)
- **Auth (JWT)** – register / login / me / logout, bcrypt hashing, 7-day access token, brute-force lockout, demo creds (admin@propflo.com/admin123, agent@propflo.com/agent123).
- **Dashboard** – KPI grid (Leads, Hot Leads, Revenue, Pipeline), lead-temperature bar, recent leads, upcoming tasks, conversion %.
- **Leads** – list with search and Hot/Warm/Cold filter chips, detail screen with quick actions (call/WhatsApp/email), **AI Insights** card, create/edit/delete.
- **Properties** – grid cards with photos, status pill, detail screen with features, image carousel ready, create/delete.
- **Pipeline (Kanban)** – horizontal board with 6 stages (New → Contacted → Site Visit → Negotiation → Closed Won → Closed Lost), per-stage value totals, tap-to-move sheet.
- **Tasks & Follow-ups** – list with priority badges, overdue highlight, swipe/tap to complete.
- **Contacts** – buyer/seller/tenant/owner with one-tap call.
- **More / Profile** – avatar, role badge, navigation to Tasks/Contacts, sign-out.

## Seeded Demo Data
6 leads, 6 properties (Mumbai/Pune), 4 contacts, 6 deals across all pipeline stages, 5 tasks (incl. one overdue, one completed).

## API (`/api`)
- `POST /auth/register | /auth/login | /auth/logout`, `GET /auth/me`
- `GET /dashboard/stats`
- Leads: `GET/POST/PUT/DELETE /leads`, `POST /leads/{id}/ai-summary`
- Properties: `GET/POST/PUT/DELETE /properties`
- Contacts: `GET/POST/DELETE /contacts`
- Deals: `GET/POST/DELETE /deals`, `PUT /deals/{id}/stage`
- Tasks: `GET/POST /tasks`, `PUT /tasks/{id}/complete`, `DELETE /tasks/{id}`

## Out of Scope (for v1)
- Push notifications, calendar sync, in-app chat, document storage, multi-tenant teams, lead web-form embed, billing.

## Smart Business Enhancement
**AI Lead Summary** turns raw lead data into a 2-paragraph qualification + 2 next-step actions, dramatically reducing rep prep-time per call and increasing follow-through. This is the platform's monetisable wedge — gate AI features behind a paid tier in v2.

## Future Roadmap
- Drag-and-drop kanban using `react-native-reanimated` + `gesture-handler`.
- WhatsApp Business API auto-templates.
- Smart deduplication of leads.
- Team workspaces with role-based access.
- Stripe/Razorpay subscription tiers (Free / Growth / Pro).
