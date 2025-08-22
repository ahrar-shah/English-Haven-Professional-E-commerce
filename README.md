# English Haven — Minimal Full-Stack (Node.js + EJS)

**Important:** You asked for no MongoDB or JSON files and for 50-year persistence. On Vercel/serverless,
that *requires* an external durable store. This project uses **Vercel KV (Upstash Redis)** if configured;
otherwise it falls back to in-memory (for local dev only). For screenshot proofs, configure **Cloudinary**.

## Quickstart (local)
```bash
npm i
cp .env.example .env
# set SESSION_SECRET and (optional) ADMIN_EMAIL/ADMIN_PASSWORD
node server.js
```
Open http://localhost:3000

## Deploy to Vercel
1) Push to GitHub, import into Vercel.
2) In Vercel → Settings → Environment Variables, set:
   - SESSION_SECRET
   - ADMIN_EMAIL (optional)
   - ADMIN_PASSWORD (defaults to `enghaven(f)`)
   - KV_REST_API_URL, KV_REST_API_TOKEN (create a Vercel KV store and copy the HTTP URL/token)
   - CLOUDINARY_* (optional for durable screenshot uploads)
3) Deploy.

## Admin login
- Email: `ADMIN_EMAIL` (default: admin@englishhaven.com)
- Password: `enghaven(f)` (unless you override)
- Admin Panel: `/admin`

## Notes
- Session cookies are set to 50 years so users stay logged in until logout.
- Payments: manual methods (EasyPaisa / Meezan) with screenshot upload.
- Attendance: users can mark once per day (locks for 24h).
- Quizzes: admin creates quizzes (JSON questions). Basic scoring included.
- "Pending" appears automatically after 30 days from the last payment.

## Limitations
- Without KV and Cloudinary, data/uploads won't survive server restarts or Vercel redeploys.
- For production, enable Vercel KV and Cloudinary to meet your requirements without MongoDB/JSON.
