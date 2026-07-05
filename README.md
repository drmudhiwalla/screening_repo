# Dr. Mudhiwalla Screening Portal

Patient screening portal with a Next.js frontend and a Node/Express backend. It supports patient registration, admin screening, WhatsApp assessment links through MSG91, Google Form response sync, stress analysis, and one-page PDF report generation.

## Project Structure

```txt
backend/   Express API, SQLite storage, MSG91 integration, Google Sheet sync, PDF generation
frontend/  Next.js app for patient registration and admin workflow
```

## Requirements

- Node.js 22+
- npm
- MSG91 WhatsApp template credentials
- Google Form response Sheet access, either public CSV or service account

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`:

```env
PORT=3101
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change_this_before_live
ASSESSMENT_URL=https://docs.google.com/forms/d/e/your-form-id/viewform

MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_WHATSAPP_NUMBER=919999999999
MSG91_TEMPLATE_NAME=your_assessment_template
MSG91_TEMPLATE_VARIABLES=customer_name

GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SHEET_GID=your_response_sheet_gid
GOOGLE_SHEET_RANGE=A:ZZ
```

Run backend:

```bash
npm run dev
```

Backend syntax check:

```bash
node --check src/index.js
```

There is no backend build step. The backend is plain Node.js.

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:3101
NEXT_PUBLIC_ASSESSMENT_URL=https://docs.google.com/forms/d/e/your-form-id/viewform
```

Run frontend:

```bash
npm run dev
```

Build frontend:

```bash
npm run build
```

## Google Form And Sheet Sync

The Google Form should collect:

- Name
- Age
- Mobile number
- The four stress assessment answers

Matching priority:

1. Mobile number
2. Name + age fallback

For private Sheets, use a Google service account:

```env
GOOGLE_SERVICE_ACCOUNT_FILE=/absolute/path/to/service-account.json
```

Then share the response Sheet with the service account `client_email`.

For public CSV access, set:

```env
GOOGLE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=...
```

## WhatsApp Reports

Assessment link sending uses:

```env
MSG91_TEMPLATE_NAME=
MSG91_TEMPLATE_VARIABLES=customer_name
```

Report link sending requires a public backend URL and a separate approved MSG91 report template:

```env
PUBLIC_REPORT_BASE_URL=https://your-backend-domain.com
MSG91_REPORT_TEMPLATE_NAME=your_report_template
MSG91_REPORT_TEMPLATE_VARIABLES=customer_name,report_url
```

For local testing, expose the backend with a tunnel such as ngrok:

```bash
ngrok http 3101
```

Then set `PUBLIC_REPORT_BASE_URL` to the HTTPS ngrok URL.

## Common Commands

Start backend:

```bash
cd backend
npm run dev
```

Start frontend:

```bash
cd frontend
npm run dev
```

Stop a backend already using port `3101`:

```bash
lsof -ti :3101 | xargs kill
```

Health check:

```bash
curl http://127.0.0.1:3101/health
```

Generate a PDF locally:

```bash
curl -o report.pdf http://127.0.0.1:3101/api/registrations/<id>/pdf
```

## Go-Live Checklist

- Change `ADMIN_PASSWORD`.
- Set `CORS_ORIGIN` to the frontend domain.
- Set `NEXT_PUBLIC_API_URL` to the public backend URL.
- Set `PUBLIC_REPORT_BASE_URL` to the public backend URL.
- Configure MSG91 assessment and report templates.
- Configure Google Sheet access through service account or public CSV URL.
- Do not commit `.env`, service account JSON, SQLite data files, or API keys.
- Rotate any key that was shared accidentally.
