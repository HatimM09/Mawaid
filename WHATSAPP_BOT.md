# Al-Mawaid WhatsApp Bot

A WhatsApp chatbot for Al-Mawaid members, built as a Supabase Edge Function
(`supabase/functions/whatsapp-bot`). It reads and writes the **same tables the
member app uses**, so a chat update shows up in the app (and on the kitchen
tracker) instantly.

| Chat command | What it does | Writes to |
|---|---|---|
| `MENU` | Today's thali menu | reads `weekly_menu` |
| `TOMORROW` | Tomorrow's menu | reads `weekly_menu` |
| `SURVEY` | Guided 12-meal weekly survey (Mon–Sat lunch + dinner) | `survey_day_responses` |
| `STATUS` | Your saved responses for the survey week | reads `survey_day_responses` |
| `FEEDBACK` | Star rating + comment for today's meal | `daily_feedback` |
| `STOP` / `RESUME` | Thali stop/resume request with dates | `thali_requests` |
| `DUES` | Monthly contribution status + UPI details | reads `user_payments`, `app_settings` |
| `QUERY` | Raise a support query | `queries` |
| `WHOAMI` | Your linked thali profile | reads `whatsapp_users` |
| `UNLINK` | Disconnect this WhatsApp number | `whatsapp_users` |
| `CANCEL` | Leave whatever flow is running | — |

---

## 1. Database

Apply the migration (adds the two bot tables, admin-readable only):

```
supabase/migrations/054_whatsapp_bot.sql
```

- `whatsapp_users` — WhatsApp phone (digits with country code) → `user_stats.user_id`
- `whatsapp_sessions` — per-chat flow state + webhook dedupe id

Run it with the Supabase CLI (`supabase db push`) or paste it into the SQL editor.

## 2. Meta WhatsApp Cloud API setup

1. Create a Meta app at <https://developers.facebook.com> → **Business** type.
2. Add the **WhatsApp** product and note:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - A **permanent access token** (System User token with `whatsapp_business_messaging`)
     → `WHATSAPP_ACCESS_TOKEN`
   - The app's **App secret** (Settings → Basic) → `WHATSAPP_APP_SECRET`
3. Register your business phone number and add a test number for development.
4. Under **WhatsApp → Configuration → Webhook**, set:
   - **Callback URL**: `https://<project-ref>.supabase.co/functions/v1/whatsapp-bot`
   - **Verify token**: the same random string you set as `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to the **messages** field.

## 3. Environment secrets

```bash
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN="EAAG..." \
  WHATSAPP_PHONE_NUMBER_ID="123456789012345" \
  WHATSAPP_VERIFY_TOKEN="some-long-random-string" \
  WHATSAPP_APP_SECRET="abc123..." \
  WHATSAPP_TZ_OFFSET_MIN="330"
```

| Secret | Required | Purpose |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | yes | Graph API bearer token |
| `WHATSAPP_PHONE_NUMBER_ID` | yes | Sender number id |
| `WHATSAPP_VERIFY_TOKEN` | yes | Webhook verification handshake |
| `WHATSAPP_APP_SECRET` | recommended | Verifies `X-Hub-Signature-256`; when unset, signature checks are skipped |
| `WHATSAPP_TZ_OFFSET_MIN` | no (default `330`) | Community timezone offset — **330 = IST**. All windows/menus use it |
| `WHATSAPP_GRAPH_VERSION` | no (default `v21.0`) | Graph API version |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 4. Deploy

`whatsapp-bot` is already registered in `supabase/config.toml` with
`verify_jwt = false` (Meta cannot send a Supabase JWT; requests are
authenticated by the webhook signature instead):

```bash
supabase functions deploy whatsapp-bot

# Test locally (Meta cannot reach localhost — use a tunnel such as ngrok)
supabase functions serve whatsapp-bot --no-verify-jwt
```

## 5. How a member gets linked

The bot matches the incoming `wa_id` against `user_stats.phone`
(country code and formatting are normalised, so `+91 98765 43210`,
`919876543210` and `9876543210` all match). If there is no match — or the
number changes — the member links once:

```
Member: hi
Bot:    🔐 Link your thali: reply with your thali number (e.g. 123)
Member: 123
Bot:    ✅ Linked! Welcome <name> — Thali 123. <menu>
```

The link lives in `whatsapp_users`; `user_stats.phone` is left untouched.
`UNLINK` removes it.

## 6. Data conventions (same as the member app)

- **Survey**: one `survey_day_responses` row per day (`mon`…`sat`) with
  `l_status`/`d_status` = `Applied`/`Skipped` and `l_dish_1..5`/`d_dish_1..5`.
  Dish values use the canonical forms the app writes: roti dishes → `Yes`/`No`,
  count dishes → `"2"`, percentage dishes → `"50%"`. Skipping a meal clears its
  dish columns; skipping dish details leaves them blank rather than inventing
  defaults (identical to `SurveyModal`).
- **Feedback**: `day` is the full weekday name, `week_id` the calendar Monday,
  with `*_stars` and `*_emoji` from the app's label set; admins get the same
  push notification the in-app form sends.
- **Dish order**: when a member fills dishes from the published menu, the bot
  also writes `dish_snapshot[<day>_<l|d>]` so the kitchen tracker keeps the same
  dish order as the app.
- **Survey window**: read live from `app_settings`
  (`survey_window_start_day/time`, `survey_window_end_day/time`,
  `survey_window_status`) — the same Saturday 20:00 → Monday 11:00 rule, so the
  bot opens and closes with the app.

## 7. Tests

`supabase/functions/whatsapp-bot/logic.ts` holds the pure rules (window,
target week, date + dish parsing) and is unit-tested:

```bash
npm test
```

`supabase/functions/whatsapp-bot/logic.test.ts` — 28 cases covering the window
boundaries in IST, target-week resolution (including admin overrides), Sunday
menu rollover, date formats and canonical dish-value parsing.

## 8. Troubleshooting

| Symptom | Check |
|---|---|
| Webhook verification fails | `WHATSAPP_VERIFY_TOKEN` matches Meta exactly; function deployed |
| 401 from the function | `WHATSAPP_APP_SECRET` mismatch — Meta signs with the app secret |
| "Graph API error" in logs | Token expired/permissions; `WHATSAPP_PHONE_NUMBER_ID` correct |
| Member not recognised | `user_stats.phone` empty or different number — member can `LINK <thali>` |
| Wrong day/menu in chat | `WHATSAPP_TZ_OFFSET_MIN` (IST = 330) |
| No reply at all | Function logs (`supabase functions logs whatsapp-bot`) |

Admin alerts for failed survey saves are sent through the existing
`send-push` function, so a bot failure is never silent.
