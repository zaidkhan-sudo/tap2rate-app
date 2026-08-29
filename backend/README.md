# Dynamic QR Backend

Backend for a dynamic QR-code system. Each physical QR code contains a permanent URL
(`https://qr.mydomain.com/q/<qrId>`) that redirects customers to that business's
Google Reviews page. The destination lives in MongoDB, so it can be changed at any
time without regenerating or reprinting the QR.

## Stack

- Node.js + Express
- MongoDB (Atlas) + Mongoose
- Designed for Vercel serverless deployment

## Project Structure

```
backend/
├── src/
│   ├── config/       # env vars, MongoDB connection (serverless-safe caching)
│   ├── controllers/  # request handlers (QR, auth)
│   ├── models/       # Qr, User, Session, Otp
│   ├── routes/       # /q/:qrId (public), /api/auth, /api/qr (protected)
│   ├── services/     # business logic: qrService, authService, otpService, emailService
│   ├── middleware/   # asyncHandler, errorHandler, requireAuth, security (helmet/cors/rate-limit)
│   ├── utils/        # tokens, passwords, validation, QR ID generation
│   ├── app.js        # Express app
│   └── server.js     # local entry point
├── scripts/          # test suites + create-admin provisioning
├── .env.example
└── package.json
```

## Local Setup

1. Copy the env file and fill in your values:

   ```
   cp .env.example .env
   ```

   - `MONGODB_URI` — MongoDB Atlas connection string
   - `QR_BASE_URL` — public base URL encoded into generated QR codes
     (use `http://localhost:5000` for local development)
   - `ACCESS_TOKEN_SECRET` — `openssl rand -hex 32`
   - `ADMIN_SETUP_EMAIL`, Gmail sender vars — for admin provisioning

2. Install dependencies:

   ```
   npm install
   ```

3. Run in development mode:

   ```
   npm run dev
   ```

4. Verify the server is up:

   ```
   curl http://localhost:5000/health
   # {"status":"ok"}
   ```

## Admin Provisioning (no public registration)

```
node scripts/create-admin.js you@example.com
```

Creates the single admin account (`verified: false`) and emails a 6-digit OTP.
Verify via `POST /api/auth/verify-email`, then log in with
`POST /api/auth/login` (email + password).

## Authentication Model

- Login: email + password (bcrypt, cost 12). Unverified accounts cannot log in.
- Access token: 15-minute JWT containing only `{id, sessionId}`; kept in memory by the frontend.
- Refresh token: 256-bit opaque random value; only its SHA-256 hash is stored in MongoDB;
  delivered as an HttpOnly, SameSite=Strict cookie scoped to `/api/auth`.
- Rotation: every refresh issues a new refresh token; presenting an already-retired token
  is treated as theft and revokes the session.
- Revocation is enforced on every request: a valid JWT whose session is revoked fails.

## Public vs Protected

| Route | Auth |
|---|---|
| `GET /q/:qrId` | none — customer scan → 302 → Google Reviews |
| `/api/auth/*` | public (login/verify/refresh/logout), `requireAuth` for `/me`, `/logout-all` |
| `/api/qr/*` | `requireAuth` |

## Notes

- `/health` exists for monitoring/debugging only. It is not a keep-alive mechanism.
- MongoDB connection and the Nodemailer transporter are cached per warm instance,
  never at import time — safe for Vercel cold starts.
- Rate limiting uses in-memory stores (per serverless instance). No Redis.
- Never commit `.env`. Real secrets live only in `.env` locally and in Vercel
  environment variables in production.
