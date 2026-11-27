# Al-Mawaid Royal WhatsApp Bot (24/7 Self-Hosted • Zero 3rd-Party)

Direct WhatsApp Web connection via Baileys — **no Meta Business verification, no Twilio, no paid 3rd-party APIs**.

## 8 Interactive Portal Modes
- `1` · **Today's Menu** (`TODAY` / `MENU`)
- `2` · **Tomorrow's Menu** (`TOMORROW`)
- `3` · **Weekly Survey & Status** (`SURVEY` / `STATUS` / `APPLY ALL` / `SKIP ALL`)
- `4` · **Stop / Resume Thali** (`STOP` / `STOP THALI` / `RESUME`)
- `5` · **Rate Meal** (`FEEDBACK` / `RATE`)
- `6` · **Thali Dues & Pay** (`DUES` / `PAY` / `PAID <UTR>`)
- `7` · **Ask Admin** (`QUERY` / `ASK`)
- `8` · **My Thali Profile** (`PROFILE` / `WHOAMI` / `UNLINK`)
- `0` · **Close Chat** (`CLOSE` / `BYE` / `EXIT`)

Admin shortcuts: `VERIFY <UTR>`, `STATS`

## 24/7 Self-Hosted Deployment

### Option A: Windows 24/7 Background Task (Recommended for Local PC / Windows Server)
```powershell
powershell -ExecutionPolicy Bypass -File whatsapp-bot-service\install-24x7-task.ps1
```
Or run the watchdog directly:
```powershell
powershell -ExecutionPolicy Bypass -File whatsapp-bot-service\start-24x7.ps1
```

### Option B: Docker (Any Linux VPS / Home Server)
```bash
cd whatsapp-bot-service
docker compose up -d --build
```

## Link WhatsApp
Open `http://localhost:3000` in your browser and scan the QR code (or enter your phone number for an 8-digit pairing code).
