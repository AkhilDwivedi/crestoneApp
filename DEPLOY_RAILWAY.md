# Deploying Crestone Realty Backend to Railway

This guide walks you through deploying **only the FastAPI backend** (not the mobile app) to Railway, so your APK has a permanent, always-on backend URL.

**Time estimate:** 15–20 minutes  
**Cost:** $0/month (free tiers cover everything)

---

## Step 1 — Create a free MongoDB Atlas cluster (5 min)

Railway's free tier doesn't include managed MongoDB, so we use **MongoDB Atlas** (also free).

1. Go to [https://cloud.mongodb.com/](https://cloud.mongodb.com/) → **Sign Up** (use your Google account for speed)
2. Pick **"Build a Database"** → choose **"M0 FREE"** tier
3. **Cloud Provider & Region**: pick AWS in a region near your users (e.g., `ap-south-1` for India, `us-east-1` for US)
4. **Cluster Name**: `crestone-prod` → click **Create**
5. **Security – Username & Password** screen:
   - Username: `crestone`
   - Password: click **"Autogenerate Secure Password"** → **COPY IT** (you'll need it next)
   - Click **"Create User"**
6. **Where would you like to connect from**: pick **"My Local Environment"** → click **"Add My Current IP Address"**
7. ⚠️ **CRITICAL**: Now click **"Network Access"** in the left sidebar → **"Add IP Address"** → click **"Allow Access from Anywhere"** (`0.0.0.0/0`) → **Confirm**
   *(Railway uses dynamic IPs so we need open access. Your username/password protect the data.)*
8. Click **"Database"** in the sidebar → click **"Connect"** on your `crestone-prod` cluster → **"Drivers"** → copy the connection string. It looks like:
   ```
   mongodb+srv://crestone:<password>@crestone-prod.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
9. **Replace `<password>`** with the password you copied in step 5. Save this — it's your `MONGO_URL`.

---

## Step 2 — Push code to GitHub (skip if already done)

If you haven't already:
1. In Emergent, click **"Save to GitHub"**
2. Note the repo URL (e.g., `https://github.com/yourname/crestone`)

The deployment files (`Procfile`, `railway.json`) are already pre-created in `/app/backend/` — they'll be in your GitHub repo.

---

## Step 3 — Create Railway project (3 min)

1. Go to [https://railway.app/](https://railway.app/) → **Sign In with GitHub**
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Authorize Railway to access your repos → pick `crestone`
4. Railway starts an initial build that **will fail** — that's expected because we haven't configured anything yet. Don't worry.

### Set the root directory
1. Click on the deployed service (the box with your repo name)
2. Go to **"Settings"** tab
3. Find **"Root Directory"** → set to `backend`
4. **"Custom Start Command"** (also under Settings → Deploy) → set to:
   ```
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
5. **"Watch Paths"** (optional, prevents redeploy on frontend changes) → set to `backend/**`

---

## Step 4 — Add environment variables (3 min)

Still in the Railway service:

1. Go to **"Variables"** tab → click **"+ New Variable"** for each of these:

| Key | Value |
|---|---|
| `MONGO_URL` | The Atlas string from Step 1 (e.g., `mongodb+srv://crestone:yourpass@...`) |
| `DB_NAME` | `crestone_crm` |
| `JWT_SECRET` | A 64-char hex string. Generate one: open https://www.random.org/strings/?num=1&len=64&digits=on&loweralpha=on&format=plain&rnd=new |
| `ADMIN_EMAIL` | `admin@crestone.com` |
| `ADMIN_PASSWORD` | Pick a strong password (e.g., `CrestoneAdmin2026!`) |
| `EMERGENT_LLM_KEY` | `sk-emergent-6A2Db89506c9c4dC1C` (your existing key) |

2. ⚠️ **Wrap values in quotes if they contain `$`, `&`, or special chars** — Railway is strict.

3. Click **"Deploy"** at the top to redeploy with the new variables. Wait ~2 minutes for the build.

---

## Step 5 — Generate a public domain (1 min)

1. In your service → **"Settings"** tab → scroll to **"Networking"**
2. Click **"Generate Domain"**
3. Railway gives you a URL like:
   ```
   https://crestone-production-abc123.up.railway.app
   ```
4. Test it in your browser:
   ```
   https://crestone-production-abc123.up.railway.app/api/
   ```
   You should see: `{"app":"PropFlo CRM","status":"ok"}`

   ✅ If yes, your backend is live!  
   ❌ If 502/503: check **"Deployments"** → **"View Logs"** for errors.

---

## Step 6 — Test login on the live backend

```bash
curl -X POST https://YOUR_RAILWAY_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crestone.com","password":"CrestoneAdmin2026!"}'
```

Should return `{"access_token":"...","user":{...}}` ✅

The seed function automatically creates the admin user on first startup using your env vars.

---

## Step 7 — Rebuild APK with the new backend URL (5 min)

On your computer:

1. Open `crestone/frontend/eas.json` and update the `production` profile:
   ```json
   "production": {
     "android": { "buildType": "apk" },
     "env": {
       "EXPO_PUBLIC_BACKEND_URL": "https://crestone-production-abc123.up.railway.app"
     }
   }
   ```
   *(Use **your** Railway URL, no trailing slash)*

2. Commit & push:
   ```powershell
   cd crestone
   git add frontend/eas.json
   git commit -m "Point production APK at Railway backend"
   git push
   ```

3. Rebuild the APK with the production profile:
   ```powershell
   cd frontend
   eas build --platform android --profile production
   ```

4. Once finished, download the new APK from [expo.dev](https://expo.dev) → install on your phone.

5. Log in with the **new admin credentials** you set in Railway:
   - Email: `admin@crestone.com`
   - Password: `CrestoneAdmin2026!` *(or whatever you set)*

🎉 You now have a permanent, production-ready APK!

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| **"PORT not bound" / "App crashed"** | Make sure start command is exactly `uvicorn server:app --host 0.0.0.0 --port $PORT` (no quotes around `$PORT`) |
| **"MongoDB connection failed"** | (a) Check you replaced `<password>` in `MONGO_URL`, (b) MongoDB Atlas → Network Access → confirm `0.0.0.0/0` is whitelisted |
| **502 Bad Gateway** | Check Railway logs (Deployments → View Logs). Common: missing env var, MongoDB auth error |
| **"emergentintegrations not found"** | Edit `backend/requirements.txt`, ensure `emergentintegrations==0.1.0` is on its own line. Railway auto-installs from requirements.txt |
| **Login returns 401 even with correct creds** | The seed runs only if no admin exists. If you changed `ADMIN_PASSWORD` after first deploy, the new password takes effect on next restart (or the seed updates it — check `seed_users()` logic) |
| **APK still hits old URL after rebuild** | Make sure you committed `eas.json` BEFORE running `eas build`. EAS reads from the GitHub commit it builds. Or use `--local` flag |
| **CORS errors in app** | Backend already has `allow_origins=["*"]` so this shouldn't happen — but if it does, restart Railway service |

---

## 💰 Cost & limits

| Service | Free tier | When you'll hit limits |
|---|---|---|
| **Railway** | $5 credit/month (~500 hours) | Personal use: never. ~50 active daily users: never. ~500+ DAU: upgrade ($5/mo "Hobby") |
| **MongoDB Atlas M0** | 512 MB storage, 100 connections | ~10,000 leads + properties: never. At 5 GB+ data: upgrade to M10 ($60/mo) |

For a typical real-estate agency (1–10 agents), free tier covers you indefinitely.

---

## 🚀 Next-level upgrades (later)

- **Custom domain**: Railway → Settings → Networking → Custom Domain → add `api.crestonerealty.com`
- **Auto-deploy on git push**: Already enabled by default — push to GitHub, Railway redeploys
- **Backups**: MongoDB Atlas → Backup → enable continuous backup ($0.01/GB/month)
- **Monitoring**: Railway has built-in metrics; or add [Sentry](https://sentry.io/) for error tracking

---

## ✅ Success checklist

- [ ] MongoDB Atlas cluster created with `0.0.0.0/0` whitelist
- [ ] Railway service deployed with all 6 env vars set
- [ ] Public domain generates JSON at `/api/` endpoint
- [ ] `curl` login test returns `access_token`
- [ ] `eas.json` production profile updated with Railway URL
- [ ] Rebuilt APK installs and logs in successfully
- [ ] App data (leads/properties/deals) loads on dashboard

Once all 7 boxes are checked, you're production-ready! 🏗️
