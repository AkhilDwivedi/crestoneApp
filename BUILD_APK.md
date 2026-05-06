# Building APK for PropFlo CRM

This guide walks you through generating a downloadable Android APK using **EAS Build**. The project is pre-configured — you only need to plug in your Expo account.

---

## ✅ Pre-configured for you
- `app.json` → name `PropFlo CRM`, slug `propflo-crm`, package `com.propflo.crm`
- `eas.json` → 3 build profiles (`development`, `preview`, `production`) all set to APK output
- `EXPO_PUBLIC_BACKEND_URL` baked into each profile (see below to change)

---

## 1. Save & clone the project locally
1. In Emergent chat, click **"Save to GitHub"** (top of screen)
2. Locally:
   ```bash
   git clone <your-github-url> propflo
   cd propflo/frontend
   ```

## 2. Install EAS CLI & log in
```bash
npm install -g eas-cli
eas login           # create a free account at https://expo.dev if needed
```

## 3. Initialise the project (one time only)
```bash
cd frontend
eas init            # auto-creates the projectId and replaces the placeholder in app.json
```
Confirm the `app.json > extra.eas.projectId` is now a real UUID.

## 4. Pick a backend URL strategy

Open `eas.json`. Each build profile already has an `env.EXPO_PUBLIC_BACKEND_URL`:

| Profile | Default value | When to use |
|---|---|---|
| `development` | Your Emergent preview URL | Local dev with the dev-client app |
| `preview` | Your Emergent preview URL | Quick demo APK pointing at the same backend you're building against |
| `production` | `https://YOUR_PRODUCTION_BACKEND_DOMAIN` ← **change this** | Real customer release |

➡️ **Before running the production build**, replace the placeholder with your deployed backend URL (Railway, Render, Fly.io, etc.).

## 5. Build the APK
```bash
# Quick demo APK (uses preview env, ~10 min build)
eas build --platform android --profile preview

# OR production-grade APK (uses production env)
eas build --platform android --profile production
```

When asked, let EAS generate a keystore (recommended — Expo manages it for you).

## 6. Download
- The build URL appears in the terminal once finished, **or**
- Go to [expo.dev](https://expo.dev) → your project → **Builds** → click the latest → **Download**

The APK can be sideloaded on any Android device.

---

## ⚙️ Common tweaks

### Change app name / icon
- Name: `app.json > expo.name`
- Icon: replace `frontend/assets/images/icon.png` (1024×1024)
- Adaptive icon: `frontend/assets/images/adaptive-icon.png`

### Bump version
- `app.json > expo.version` (semver e.g. `1.1.0`)
- `app.json > expo.android.versionCode` (must increase by 1 for every Play Store upload)

### Add device permissions
Add to `app.json > expo.android.permissions`. Already includes `INTERNET`. If you later add features:
- Camera: `android.permission.CAMERA`
- Location: `android.permission.ACCESS_FINE_LOCATION`
- Contacts: `android.permission.READ_CONTACTS`

### Switch to AAB (for Play Store)
Edit `eas.json > build.production.android.buildType` from `"apk"` to `"app-bundle"` and run:
```bash
eas build --platform android --profile production
eas submit --platform android       # uploads directly to Play Console
```

---

## 🚨 Backend URL gotcha
The `EXPO_PUBLIC_BACKEND_URL` is **embedded at build time** — changing it later requires a new build. The local `frontend/.env` is **only used for `expo start`** (preview); EAS Build reads from `eas.json > env`.

## 🆓 Free tier
- **30 builds/month** on Expo's free plan
- Builds typically take 10-20 minutes
- Paid plans start at $29/mo for unlimited

---

## 🆘 Troubleshooting

| Issue | Fix |
|---|---|
| `eas init` asks for project owner | Pick your personal Expo account |
| Build fails with package conflict | Run `eas build:configure` and let it pick latest SDK 54 versions |
| APK installs but shows blank/loading screen | The backend URL in `eas.json` is wrong or the backend is down |
| "Invalid keystore" | Delete keystore on Expo dashboard and rebuild |
| API calls fail in production | Update `production.env.EXPO_PUBLIC_BACKEND_URL` to your live FastAPI host |
