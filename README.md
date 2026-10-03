# NiveshRakshak — Final Full-Stack Hackathon Project

NiveshRakshak is a safety-first financial message analysis assistant. Users can paste a suspicious message or upload a screenshot. Screenshot text is extracted locally in the browser using Tesseract.js (English + Hindi), then the extracted text is sent to a backend API for explainable risk-indicator analysis and database history.

> **Important:** This is an educational safety prototype. It does not prove that a message is fraudulent or legitimate and it does not provide investment advice.

## Architecture

```text
Browser UI
  ├── Message input
  ├── Screenshot upload
  │      └── Tesseract.js OCR (local browser)
  └── Risk result UI
          │
          ▼
      Express REST API
          │
          ├── Validation + rate limiting
          ├── Explainable risk engine
          └── Anonymous session history
                  │
                  ▼
             PostgreSQL DB
          ├── scans
          └── scan_signals
```

## Main features

- Message scanner
- Screenshot OCR using Tesseract.js (`eng+hin`)
- Image preprocessing before OCR
- Explainable risk indicators
- Hindi/Hinglish detection
- Anonymous browser session ID; no account required
- Persistent backend history
- PostgreSQL production database
- Local JSON fallback for quick development when `DATABASE_URL` is absent
- Privacy-aware default: screenshots are processed in the browser and are not uploaded; full text is not stored by default
- Official verification links
- Rate limiting, Helmet and basic request validation
- Responsive hackathon UI

## Risk engine

The prototype currently detects configurable indicators such as:

- Guaranteed return / unrealistic profit
- Urgency / FOMO
- Payment pressure
- Sensitive credential requests
- Unverified financial claims
- Possible impersonation

Scores are intentionally described as **risk indicators**, not a fraud verdict.

## Run locally — easiest

### Option A: Node only (no PostgreSQL installation)

1. Install Node.js 20+.
2. Open this project folder in Terminal/PowerShell.
3. Run:

```bash
npm install
npm start
```

4. Open `http://localhost:3000`.

Without `DATABASE_URL`, the app uses `data/scans.json` as a local development fallback. This is only for development/demo use.

### Option B: Full PostgreSQL with Docker

Install Docker Desktop, then from the project folder:

```bash
docker compose up --build
```

Open `http://localhost:3000`.

The app connects to PostgreSQL automatically and creates the tables from `schema.sql`.

## Environment variables

Copy `.env.example` to `.env` if you use a process manager that loads `.env`.

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/niveshrakshak
STORE_FULL_TEXT=false
PORT=3000
```

`STORE_FULL_TEXT=false` is recommended. With this setting the database stores a text hash and short preview, not the complete submitted message.

## Deploy on Render

The repository includes `render.yaml` for a Render web service + PostgreSQL database.

1. Push the project to GitHub.
2. In Render, create a Blueprint from the repository.
3. Render reads `render.yaml` and provisions the web service and PostgreSQL database.
4. Wait for the build and open the generated `.onrender.com` URL.
5. Test `/api/health` and then the screenshot OCR flow.

If you do not want to use the Blueprint, create a Node web service manually with:

- Build command: `npm install`
- Start command: `node server.js`
- Add a PostgreSQL database and set `DATABASE_URL`.

## API

### `GET /api/health`

Returns backend/database status.

### `POST /api/analyze`

Example body:

```json
{
  "sessionId": "browser-generated-uuid",
  "source": "Message",
  "text": "Guaranteed 40% profit in 7 days. Invest today."
}
```

Returns score, level, tone, signals and storage metadata.

### `GET /api/scans?sessionId=...`

Returns up to 20 recent scans for the anonymous session.

### `DELETE /api/scans?sessionId=...`

Clears that session's scan history.

## Database design

### `scans`

Stores scan-level information: session ID, source, language, score, level, hash, preview and timestamp.

### `scan_signals`

Stores the individual indicators detected for each scan. It has a foreign key to `scans` and is deleted automatically when the scan is deleted.

## Privacy model

- Screenshot OCR happens in the user's browser.
- The screenshot itself is not uploaded to the backend.
- By default, full extracted message text is not stored.
- The backend stores an anonymous session ID, score, signal metadata, text hash and short preview.
- No investment account, OTP, password or financial credentials should ever be submitted.

## Demo flow

1. Open the site.
2. Click **Quick Demo → Suspicious investment** and analyze it.
3. Switch to **Screenshot**.
4. Upload the WhatsApp-style test screenshot.
5. Click **Extract Text & Analyze**.
6. Show the OCR extracted text.
7. Show the risk score and explainable red flags.
8. Open Recent Scans to demonstrate database persistence.

## Production improvements

For a real-world deployment, add authenticated accounts only when necessary, a stronger multilingual ML classifier, official registry integrations, monitoring, automated tests, a content moderation/security review, stronger privacy controls and calibrated evaluation against a labeled dataset.
