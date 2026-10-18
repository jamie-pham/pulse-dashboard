# Pulse

A personal dashboard for one person: recovery, strain and sleep from a Fitbit Air, plus weather, today's calendar, Tanda shifts, Monash classes and deadlines, Gmail, Notion and GitHub. It's a Next.js web app you install on your iPhone home screen.

At the top is a **brief** that changes with the time of day. In the morning it covers the weather, what to take, recovery, your first commitment with a "leave by" time, what's due, and anything near you on VicEmergency. In the evening it covers your bedtime, tomorrow's weather and your first thing tomorrow. Tap **Read it to me** to hear it, or have your iPhone read it out when you stop your alarm (see section 6).

```
npm install
cp .env.example .env.local    # DEMO_MODE=1 is already set
npm run dev                   # http://localhost:3000
npm test                      # scoring + timezone tests
```

With `DEMO_MODE=1` you see the full dashboard with fake data and can skip all the setup below. Connect sources one at a time after that. Each card works or fails on its own.

---

## 1. Deploy (do this first, since Google needs a real URL)

1. Push this folder to a **private** GitHub repo.
2. In Vercel, click **Add New → Project**, import the repo, and deploy. You'll get a URL like `https://pulse-jamie.vercel.app`.
3. Go to **Vercel → Storage → Marketplace → Upstash (Redis)** and connect it to the project. It's free, and it sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for you.
4. In **Settings → Environment Variables**, set `APP_URL` (the Vercel URL), `DASHBOARD_PASSWORD`, `SESSION_SECRET` (`openssl rand -hex 32`) and `DEMO_MODE=1`, then redeploy.
5. On your iPhone, open the URL in **Safari**, tap **Share → Add to Home Screen**, then open it from the icon and log in. It runs full-screen like a normal app.

## 2. Google: Fitbit Air, Calendar and Gmail (one sign-in)

> ⚠️ **Do this before 30 Oct 2026.** The old Fitbit Web API shuts off then. This app uses the new **Google Health API**. Google's docs currently say they aren't onboarding new projects, but they also publish beginner codelabs. If enabling the API fails, that's why, and the other cards will still work.

1. Install the **Google Health** app on your phone, sign in with the same Google account your Fitbit Air uses, and let it sync.
2. In [Google Cloud console](https://console.cloud.google.com/), create a new project.
3. Under **APIs & Services → Library**, enable **Google Health API**, **Google Calendar API** and **Gmail API**.
4. Under **Google Auth Platform → Branding/Audience**, choose user type **External** and leave the app in **Testing**. Under **Test users**, add your own Gmail address.
5. Under **Data Access → Add scopes**, add:
   - `.../auth/googlehealth.sleep.readonly`
   - `.../auth/googlehealth.health_metrics_and_measurements.readonly`
   - `.../auth/googlehealth.activity_and_fitness.readonly`
   - `.../auth/calendar.readonly`
   - `.../auth/gmail.readonly`
6. Under **Credentials → Create credentials → OAuth client ID**, choose **Web application**:
   - Authorised redirect URI: `https://YOUR-APP.vercel.app/api/google/callback` (add `http://localhost:3000/api/google/callback` too if you develop locally)
7. Put the client ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, set `DEMO_MODE=0`, and redeploy.
8. Open the app, tap **Connect Google**, and **tick every box** on the consent screen.

**The 7-day thing:** while the Google app is in "Testing", Google expires the sign-in every 7 days. The dashboard warns you two days before; just tap **Reconnect Google**. Publishing the app would remove that limit, but Google requires a verification review for health and Gmail scopes, which isn't worth it for a one-person app.

## 3. Tanda (shifts)

Log in to Tanda on the web and look for **API / Access tokens** under your profile or settings. Create a token with the **`me`** and **`roster`** scopes, then set it as `TANDA_TOKEN`.

If your employee account can't see that page, use Tanda's password grant once from a terminal and paste the `access_token` it returns:

```
curl https://my.tanda.co/api/oauth/token -X POST -H "Content-Type: application/json" \
  -d '{"username":"YOU@email.com","password":"YOUR_PASSWORD","scope":"me roster","grant_type":"password"}'
```

## 4. Monash

| Source | Where to get it | Reliability |
|---|---|---|
| **Moodle deadlines** | Moodle → Calendar → **Export calendar** → All courses, Recent and next 60 days → **Get calendar URL** → `MOODLE_ICS_URL` | Solid (official feature) |
| **Timetable** | MyTimetable (Allocate+) → the calendar **subscribe/sync** link → `TIMETABLE_ICS_URL` | Solid (official feature) |
| **Ed** | [edstem.org/au/settings/api-tokens](https://edstem.org/au/settings/api-tokens) → `ED_TOKEN`. FIT1008's course ID is `37681`. | Okay (personal token, unofficial endpoints) |
| **OnTrack** | Log in → browser devtools → Network → click any `/api/` request → copy the `Username` and `Auth-Token` request headers and the API host | Fragile (token expires, so you'll need to re-copy it) |

Ed and OnTrack don't offer public student APIs, so these cards use **your own token, read-only, for your own data**. Before relying on them, check that this fits Monash's IT acceptable-use policy. If they break, the rest of the dashboard keeps working.

## 5. Notion and GitHub

- **Notion:** at [notion.so/my-integrations](https://www.notion.so/my-integrations), create an internal integration, copy the secret into `NOTION_TOKEN`, then open your tasks database → **⋯ → Connections → add the integration**. The database ID is the 32-character string in its URL. Set `NOTION_DATE_PROP` and `NOTION_STATUS_PROP` to whatever your columns are called.
- **GitHub:** create a fine-grained token with **read-only** access to the Anchor repos (Metadata, Issues, Pull requests). Set `GITHUB_REPOS=org/repo,org/repo2`.

---

## 6. Wake-up brief: your iPhone reads it out when you stop your alarm

1. Set `BRIEF_TOKEN` in Vercel to a long random string (`openssl rand -hex 24`) and redeploy.
2. In the **Shortcuts** app, open **Shortcuts → +** and name it **Morning brief**. Add these actions:
   1. **Get Contents of URL**: `https://YOUR-APP.vercel.app/api/brief?format=text&fresh=1`. Tap **Show More → Headers → Add new header**: key `Authorization`, value `Bearer YOUR_BRIEF_TOKEN`.
   2. **Speak Text**: Contents of URL. Pick an Australian voice if you like.
   3. **Open URLs**: `https://YOUR-APP.vercel.app/?wake=1`
3. Open **Automation → + → Alarm**, choose **Is Stopped** and **Wake-Up** (or *Any alarm*), then **Run Immediately** → **Morning brief**.

Stop the alarm and your phone tells you the weather, whether to take an umbrella, your recovery, when to leave for your first class or shift, and what's due. Then it opens the full dashboard.

- **Weather where you actually are:** add **Get Current Location** before step 1, then add `&lat=` *Latitude* `&lon=` *Longitude* to the URL. Pulse saves your location, rounded to about 1 km. You can also tap **📍 use my location** in the app.
- **Open URLs opens Safari**, which keeps its own login separate from the home-screen app, so log in once there too. The login lasts 90 days.
- **Bedtime version:** make a second automation, **Sleep → Wind Down begins** (or a time like 9:30pm), running the same shortcut. After 5pm the brief switches to tonight's bedtime and tomorrow's plan.
- **Preview without waiting:** in demo mode, open `/?at=07:05` or `/?at=20:30`.

## Weather and alerts

- **Weather** comes from [Open-Meteo](https://open-meteo.com/). It's free, needs no key, and uses the Bureau of Meteorology's model in its blend. You get current conditions, a 14-hour strip, highs and lows, sunset and air quality, plus plain-English advice: umbrella (≥ 50% rain), jacket (feels ≤ 10°), layers (≥ 10° swing), sunscreen (UV ≥ 3, the Cancer Council threshold), heat, wind and smoke.
- If you have a class today, the brief also gives the **campus forecast** for your first class.
- **Near you:** active incidents within `ALERT_RADIUS_KM` (default 15 km) and warnings within 45 km, from VicEmergency's public feed. Incidents that are safe or under control, and planned burns, are filtered out.
- **Morning routine:** a tick-list from `MORNING_ROUTINE` that resets each day. **Countdowns** come from `COUNTDOWNS`, e.g. exams or the Security+ exam.

## How the scores work

These are Pulse's own models, built from published methods. They are **not** Whoop's or Fitbit's proprietary algorithms. The full logic is about 100 lines in `lib/scoring.ts`.

**Recovery (0–100%)** compares last night to *your* rolling 30-day baseline:
- **HRV** (55%): z-score of ln(RMSSD) against your baseline. HRV is log-normal, so the log is used.
- **Resting HR** (20%): z-score, inverted (lower is better).
- **Sleep performance** (25%): hours slept ÷ hours needed.

The weighted z-score passes through a logistic curve. An average night lands around 60%; one standard deviation better is around 80%. Bands match Whoop's: green ≥ 67, yellow 34–66, red ≤ 33. You need about 7 nights of data before a score appears ("calibrating").

**Strain (0–21)** is Banister TRIMP from minute-level heart rate:
- Each minute contributes `x · 0.64 · e^(1.92x)` (female: 0.86 / 1.67), where x is the fraction of heart-rate reserve.
- Minutes below 30% of reserve are ignored, so desk time doesn't add up.
- Total load maps to `21 · (1 − e^(−TRIMP/70))`. A 60-minute lifting session comes out around 10–12, a hard 60-minute run around 17.

**Sleep need** is 8h plus up to 1h extra after a high-strain day. **Bedtime** works backwards from tomorrow's first event (Tanda shift, class or calendar), allowing 60–75 minutes to get ready and travel.

To tune it, set `HR_MAX` if you know your real max (it matters more than anything else for strain), or change `STRAIN_K` and the weights in `lib/scoring.ts`. Run `npm test` afterwards.

## Layout

```
app/page.tsx              dashboard (server-rendered)
app/components/           rings, sleep, strain, timeline, due list, …
lib/sources/health.ts     Google Health API → HRV, RHR, sleep, minute HR, steps, workouts
lib/sources/*.ts          calendar, gmail, tanda, ics (moodle/timetable), ed, ontrack, notion, github
lib/scoring.ts            recovery + strain + sleep need (pure, tested)
lib/coach.ts              plain-English advice + tonight's bedtime
lib/brief.ts              the time-aware brief (morning / day / evening / night) + spoken version
lib/sources/weather.ts    Open-Meteo forecast + air quality;  lib/weather-advice.ts = what to take
lib/sources/alerts.ts     VicEmergency incidents/warnings near you
app/api/brief             brief as text/JSON for the iOS Shortcut (Bearer BRIEF_TOKEN)
lib/dashboard.ts          runs every source in parallel with per-source caching
```

Data is cached for 3–30 minutes per source. The refresh button bypasses the cache, and the app auto-refreshes when you reopen it after 5+ minutes. Finished days' strain is cached permanently, so history loads fast.

## Ideas for v2
- Push notifications (iOS 16.4+ supports them for home-screen web apps), e.g. "leave for your shift in 30 min".
- Live traffic or PTV departures for "leave by" times, which currently use fixed minutes from `TRAVEL_*`.
- Google Health webhooks, so new sleep data arrives the moment it syncs.
- Hevy and MyFitnessPal cards.
