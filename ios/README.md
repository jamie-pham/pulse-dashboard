# Pulse for iPhone — lock screen widgets

The point: see what matters **without unlocking your phone**, so you never end up in another app.

| Where | Shows |
|---|---|
| Lock screen rectangle | 3 lines that change through the day: **Leave in 12:04** (live countdown) → next class/shift → weather & rain time → study window → next deadline |
| Lock screen inline (above the clock) | `Leave 9am · FIT1008 Applied`, or `14° · 10am FIT1008 Applied` |
| Lock screen circle | Leave countdown when it's close, otherwise recovery %, otherwise temperature |
| Live Activity / Dynamic Island | "Leave in 14:32" with a progress bar, up to 2h before you need to go |
| Home screen / StandBy | Same rows, small or medium |

Emergency warnings jump to the top line. The widget gets only what it shows (no email, no pay); see `lib/widget.ts`.

## Set up (about 15 minutes, free)

1. **Install Xcode** from the Mac App Store and open it once so it can install its components. Then in Terminal:
   ```sh
   brew install xcodegen      # no Homebrew? see https://brew.sh
   git clone https://github.com/jamie-pham/pulse-dashboard.git && cd pulse-dashboard/ios
   cp Config.example.xcconfig Config.xcconfig
   open -e Config.xcconfig
   ```
2. **Fill in `Config.xcconfig`:**
   - `PULSE_TOKEN`: the same value as `BRIEF_TOKEN` in Vercel → Settings → Environment Variables.
   - `DEVELOPMENT_TEAM`: in Xcode → Settings → Accounts, add your Apple ID. Your team ID is the 10-character code shown for "(Your Name) (Personal Team)". If you can't see it, leave it blank and pick the team in step 4.
3. `xcodegen && open Pulse.xcodeproj`
4. Plug in your iPhone. Pick it in the device menu at the top of Xcode. If Signing complains, click each target (**Pulse** and **PulseWidgets**) → Signing & Capabilities → Team → your Personal Team.
5. On the iPhone: **Settings → Privacy & Security → Developer Mode → On** (it restarts). Then press ▶ in Xcode.
6. The first launch says "Untrusted Developer". Go to **Settings → General → VPN & Device Management**, tap your Apple ID, then **Trust**.
7. Open Pulse once and log in. Then long-press the lock screen → **Customize → Lock Screen** → tap the widget area → **Pulse**. Add the rectangle, and the circle too if you like.

### Things to know on the free Apple ID
- **The app stops opening after 7 days.** Plug in and press ▶ again to reinstall. Your login and widgets stay. (The $149 AUD/year developer program makes it a year, and adds TestFlight.)
- **The Live Activity starts when the app opens**, because iOS only allows that from an open app. Tapping a widget opens it. For a hands-off morning, add **Open URLs → `pulse://open`** to your alarm Shortcut. With the paid program, the server can start it by push instead (`push-to-start`). That's the upgrade worth paying for.
- **Widgets refresh about every 30 minutes**, and iOS decides exactly when. The countdown and "what's next" still change on time, because the phone already has the day's times.
- **Google sign-in opens in Safari.** Google blocks it inside apps. Reconnect from Safari or from the Home Screen web app.
- **Keep the Home Screen web app for now** if you want its push notifications. This app can't receive web push; native notifications need the paid program.

## Updating
`git pull && cd ios && xcodegen`, then ▶. Every push that touches `ios/` is compiled on a GitHub-hosted Mac (`.github/workflows/ios.yml`), so the build should already be known to work.

## Files
- `Shared/Feed.swift`: fetches `GET /api/widget` (Bearer token) and caches the last good copy.
- `Shared/Glance.swift`: decides what the lock screen says at any moment. This is the bit to tweak.
- `Widget/`: the widgets and the Live Activity's look.
- `App/`: the dashboard web view, plus refreshing widgets and Live Activity on open.
