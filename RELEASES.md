# Al-Mawaid Releases

## v2.1.9 — 2026-10-06

### Payments — bank-rejection resilience
- Pre-pay confirm sheet shows the exact intent payload (receiver VPA, payee, 2-decimal amount, note) before anything fires.
- Alternate intent format (unique `tr` reference) + failure-diagnostics sheet explaining daily-quota / receiver-cap / blocked-intent causes with one-tap fixes.
- Optional fallback receiver VPA (`upi_id_2`) in manager settings + "Use Alternate Receiver" option.
- Desktop QR follows the confirmed plan; idempotent finalize; recovery banner gained "Payment failed?" entry.

### Build
- Version bumped to 2.1.9 (live-link: Android loads https://al-mawaid.vercel.app?v=2.1.9, no new AAB needed).

## v2.1.8 — 2026-10-06

### Survey
- No auto-select: every dish starts unselected, member taps each choice; strict 12-meal completion gating.
- Bright celebratory survey theme with selection animations (pop, card flash, summary pills, pick counters).

### Notifications (outside-app)
- Removed all in-app popup toasts/banners (member + admin); OS-level push only, stored in Alerts tab + inbox.
- Notification tap opens the app on the related action page (fixed broadcast URLs, SW always notifies, cold-start deep links).
- App-icon notification badge (Badging API) + maskable PWA icons (auto device-shape).

### Payments
- Reliable Pay: generic UPI chooser with receiver + 2-decimal amount prefilled; auto-split above ₹1L cap; VPA validation.
- Copy & Pay tab and manual UTR entry removed; receipts auto-generate on return with PDF download (slip modal, history rows, receipt view).
- Security wall (validation, cooldown, idempotency, amount integrity), unfinished-payment recovery banner, dispute/refund flow + Refund Policy sheet.
- Monthly dues tracker (6-month strip, due banner, Pay Balance, monthly self-reminder) + PWA bottom-sheet modals.

### Build
- Version bumped to 2.1.8 (live-link: Android loads https://al-mawaid.vercel.app?v=2.1.8, no new AAB needed).

## v2.1.4 (versionCode 42) — 2026-08-21

### Bug fixes
- **ProfilePage**: Fixed `ReferenceError: fetchUserOverrideRows is not defined` — replaced defunct call with the correct `fetchUserSurveyRow` import.
- **ProfilePage**: Added missing `ErrorBanner` import from `../ui`.
- **DailySurveyModal**: Fixed syntax error (stray closing brace) inside `loadExisting` useEffect that could break survey loading.

### Build
- Version bumped to 2.1.4 (versionCode 42).
- Signed release AAB: `app-release.aab` (5.6 MB), ready for Google Play upload.

## v2.1.3 (versionCode 41) — 2026-08-18

### Live-link (fully linked) build
- The Android app now loads the web app directly from **https://al-mawaid.vercel.app** (`server.url` in `capacitor.config.ts`, `cleartext: false`) instead of bundling the web assets — every app update ships instantly without a new Play release.
- Version bumped to 2.1.3 (versionCode 41) so Google Play accepts the new bundle.
- Signed release AAB: `Al-Mawaid-v2.1.3.aab` (same Al-Mawaid upload cert, CN=Al-Mawaid).

## v2.1.2 (versionCode 40) — 2026-08-15

### Survey integrity
- **No more silent saves**: every member survey write now goes through a single audited path — the `submit-survey` edge function logs each save (success **and** error) to the new `survey_write_log` table. Failed saves are visible instead of swallowed.
- New admin **Survey Write Log** page (Admin → Write Log): realtime stream of every save with success/failure badges, payload drill-down, filters and search.
- **Dish snapshots**: submissions now store the dish list the member rated against (`dish_snapshot`), and every reader resolves dish names from that snapshot — editing the menu after a member submits no longer mislabels old responses.
- **dish_7 … dish_14** columns added for all day/meal slots: menus with more than 6 dishes no longer silently drop answers.
- New admin **Survey Accuracy** page (Admin → Accuracy): per-member weekly progress vs. expected slots (accounting for stop/resume requests), Complete / Partial / No-response / Failed-saves flags, per-slot grid, and CSV export.
- Configurable survey window: `survey_open_hour` / `survey_close_hour` app settings (defaults 20:00 / 11:00). A force-opened survey now targets the next week correctly all day on Saturday.
- `submitted_at` timestamp + composite `(user_id, week_id)` index on full weekly submissions.

### Member app
- Refactored the ~2,900-line `App.jsx` into a modular `src/member/` app: `ThaliUserApp` + Home / Weekly Menu / Survey / Requests / Profile pages + shared theme, sound and survey modules.

### Admin & automations
- Weekly menu editor now stores row-per-day in the dedicated `weekly_menu` table (with Urdu day names); settings page rewritten around it (survey hours, weekly reminders, UPI / helpline settings).
- Broadcast pushes now record **real sent/failed device counts** on the broadcast record, so admin dashboards show actual delivery coverage.
- Extra-food requests distinguish **Addition vs Deduction** (`extra_mode` column on `thali_requests`).
- Scheduled automations actually run now: `pg_cron` inside Supabase fires `process-scheduled` every minute and `survey-digest` for auto open/close/reminders/digest (migration 027), with a GitHub Actions 5-minute fallback cron (`.github/workflows/automation-cron.yml`) as a safety net.
- Realtime replication enabled for all app tables (migration 025), so admin survey opens/toggles reach member devices live; avatar URLs rewritten to the current Supabase project (migration 024).

### Android
- Upgraded AGP to 9.0.1 and Gradle wrapper to 9.1.0.
- Removed cleartext traffic and `READ_EXTERNAL_STORAGE` per Google Play policy; new upload certificate (`android/upload_certificate.pem`).
- Signed release AAB: `Al-Mawaid-v2.1.2.aab` (built via CI `deploy-android` workflow — rebuild after the final Aug 15 admin-page wiring).

## v2.1.1 (versionCode 39) — 2026-08-11

### Survey
- New **Review & Submit** step: after filling the whole week (Mon–Sat), members land on a review screen showing the full week with ✏️ Edit on every day, so they can go back and change any day before submitting.

### Tooling
- `npm test` now runs on the threads pool so it no longer flakes/times out on Windows.
- ESLint now ignores generated build assets (`dist`, `android`, `native/dist`), cutting false-positive errors from ~3600 to ~185.

### Web
- Deployed to Vercel production: https://al-mawaid.vercel.app

### Android AAB
- Signed release AAB: `Al-Mawaid-v2.1.1.aab` (SHA256withRSA, 2048-bit key, cert CN=Al-Mawaid).

## v2.0.8 (versionCode 36) — 2026-08-06

### Survey
- Survey modal for override users now scopes to only the meals granted by the override, so they only rate the dishes they actually received.

### Android AAB
- Signed release AAB: `Al-Mawaid-v2.0.8.aab` (SHA256withRSA, 2048-bit key, cert CN=Al-Mawaid).

## v2.0.7 (versionCode 35) — 2026-08-06

### Admin
- Auto-collapsing sidebar (icon rail) with persisted collapse state on desktop and overlay drawer on mobile; bottom navigation removed.
- Query "Mark In Progress" now notifies the affected user with an in-app + push notification.

### Survey
- Survey form requires all dishes answered before auto-advancing; removed the manual "Save & Continue" button.

### Notifications
- Admin user-name alerts on query/request actions; one-time approval & survey notifications.
- Fixed notifications schema (dropped type CHECK constraint, added member insert policy).

### Native (Android)
- New app icons and splash screen (adaptive icons).
- Added privacy site (privacy-site/) and in-app privacy policy page.
- Removed `READ_MEDIA_IMAGES` permission; scoped `READ_EXTERNAL_STORAGE` to maxSdkVersion 32 per Google Play policy.

### Android AAB
- Signed release AAB: `Al-Mawaid-v2.0.7.aab` (SHA256withRSA, 2048-bit key, cert CN=Al-Mawaid).
