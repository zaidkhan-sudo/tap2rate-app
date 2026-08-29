# Tap2Rate

> **Turn every scan into a Google review.**

Tap2Rate is a dynamic QR-code management platform designed for businesses that want to make it easy for customers to leave Google Reviews.

Each physical QR code contains a unique Tap2Rate URL. When a customer scans the QR code, Tap2Rate looks up the QR in the database and redirects the customer directly to that business's Google Review page.

The QR code itself never contains the Google Review URL, making the system dynamic and allowing the destination to be changed without reprinting the physical QR code.

---

## How It Works

```text
                    ADMIN
                      │
                      ▼
              React Admin Dashboard
                      │
                      ▼
                Backend API
                      │
                      ▼
                 MongoDB Atlas
                      │
                      │
                QR → Business
                      │
                      ▼
              Google Review URL


                    CUSTOMER
                       │
                   Scan QR
                       │
                       ▼
          qr.yourdomain.com/q/X91mQa
                       │
                       ▼
                  Backend API
                       │
                  MongoDB lookup
                       │
                       ▼
              Google Review URL
                       │
                       ▼
                Google Reviews
                       │
                       ▼
                 ⭐ Rating
                 ✍️ Review
```

The customer does not need to log in or interact with the Tap2Rate frontend.

---

# Core Features

* Dynamic QR codes
* Unique QR URL for every QR code
* Assign QR codes to businesses
* Connect QR codes to existing Google Review pages
* Change a QR's destination without reprinting the physical QR
* Activate/deactivate QR codes
* Admin dashboard
* QR search and filtering
* QR generation and SVG download
* Admin authentication
* Email verification through OTP
* Secure access-token and refresh-token authentication
* MongoDB-backed sessions
* Refresh-token rotation and reuse detection
* Serverless-compatible architecture
* Responsive admin interface
* PWA support for mobile admin usage

---

# Dynamic QR System

A physical QR code does not directly contain the Google Review URL.

Instead, it contains a Tap2Rate URL:

```text
https://qr.yourdomain.com/q/X91mQa
```

The backend stores the relationship:

```text
X91mQa
    ↓
Sharma Electronics
    ↓
Google Review URL
```

When the QR is scanned:

```text
QR
 ↓
Tap2Rate URL
 ↓
Backend
 ↓
MongoDB
 ↓
Google Review URL
 ↓
Google Reviews
```

This allows the Google Review destination to be changed later without changing the physical QR code.

---

# QR Lifecycle

```text
Generate QR
     ↓
UNUSED
     ↓
Print QR
     ↓
Give/Sell QR to Business
     ↓
Assign Business + Google Review URL
     ↓
ACTIVE
     ↓
Customers scan QR
     ↓
Google Reviews
```

A QR can also be:

```text
DISABLED
```

when it should no longer redirect.

---

# Technology Stack

## Frontend

* React
* JavaScript
* Vite
* Responsive UI
* PWA support
* `qrcode.react` for QR generation

## Backend

* Node.js
* Express
* Mongoose
* JWT
* bcrypt/bcryptjs
* Nodemailer

## Database

* MongoDB
* MongoDB Atlas

## Email

Email verification uses OTP.

OAuth 2.0 may be used by the email service/provider (for example Gmail OAuth2 with Nodemailer) to authorize email sending.

OAuth 2.0 for email sending is completely separate from application login.

## Deployment

The initial deployment target is:

* Vercel
* MongoDB Atlas

The application is designed so that the public QR URL remains independent from the hosting provider.

---

# Authentication

Tap2Rate has a single administrator.

There is no public user registration.

The admin logs in using:

```text
Email
Password
```

Passwords are hashed using bcrypt.

The authentication flow is:

```text
Email + Password
       ↓
Backend
       ↓
bcrypt verification
       ↓
Email verified?
       ↓
Create application session
       ↓
Access Token
       +
Refresh Token
```

### Access Token

* JWT
* Short-lived
* Approximately 15 minutes
* Contains user ID and session ID

### Refresh Token

* Cryptographically random opaque token
* Stored in an HttpOnly cookie
* Only its SHA-256 hash is stored in MongoDB
* Rotated whenever it is refreshed
* Old-token reuse detection is implemented

### Sessions

Sessions are stored in MongoDB and can be revoked.

This allows:

* Logout
* Logout from all devices
* Session invalidation
* Refresh-token reuse detection

---

# Email Verification

When the admin account is provisioned, the email can be verified using a one-time password.

Flow:

```text
Admin account
      ↓
Generate 6-digit OTP
      ↓
Hash OTP
      ↓
Store hashed OTP
      ↓
Send email
      ↓
Admin enters OTP
      ↓
Verify OTP
      ↓
Email marked verified
```

OTP security includes:

* short expiration
* attempt limits
* resend cooldown
* single-use behavior
* hashed storage

The email service is kept separate from the application's authentication system.

---

# Admin Dashboard

The React frontend is intended for the administrator.

Customers do not use the dashboard.

The admin dashboard will provide:

### Dashboard

Overview of:

* Total QR codes
* Active QR codes
* Unused QR codes
* Disabled QR codes

Future versions may also include scan analytics.

### QR Management

The admin can:

* Generate QR codes
* View QR codes
* Search QR codes
* Filter by status
* Assign QR codes
* Edit QR destinations
* Disable QR codes
* Download QR codes as SVG

### Business Assignment

For an unused QR:

```text
QR ID:
X91mQa

Business Name:
Sharma Electronics

Google Review URL:
https://g.page/r/XXXXXXXX/review
```

After assignment:

```text
X91mQa → Sharma Electronics → ACTIVE
```

---

# Public QR Endpoint

The main public endpoint is:

```http
GET /q/:qrId
```

Example:

```http
GET /q/X91mQa
```

This endpoint does not require authentication.

It:

1. Finds the QR.
2. Checks that it exists.
3. Checks that it is active.
4. Retrieves the Google Review URL.
5. Returns an HTTP 302 redirect.

Example:

```text
GET /q/X91mQa
        ↓
MongoDB
        ↓
Google Review URL
        ↓
302 Redirect
```

Customers never need a Tap2Rate account.

---

# API Overview

## Public

```http
GET /q/:qrId
```

Redirects the customer to the configured Google Review page.

## Authentication

```http
POST /auth/login
POST /auth/verify-email
POST /auth/resend-otp
POST /auth/refresh
POST /auth/logout
POST /auth/logout-all
GET  /auth/me
```

## QR Management

Example administrative endpoints:

```http
POST   /api/qr
GET    /api/qr
GET    /api/qr/:qrId
PATCH  /api/qr/:qrId
PATCH  /api/qr/:qrId/status
```

Administrative QR endpoints require authentication.

---

# Example Database Document

A QR record can look like:

```json
{
  "qrId": "X91mQa",
  "businessName": "Sharma Electronics",
  "googleReviewUrl": "https://g.page/r/XXXXXXXX/review",
  "status": "ACTIVE",
  "createdAt": "2026-08-27T00:00:00.000Z",
  "assignedAt": "2026-08-27T00:15:00.000Z",
  "updatedAt": "2026-08-27T00:15:00.000Z"
}
```

---

# Project Structure

A typical project structure:

```text
Tap2Rate/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── scripts/
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── public/
│   ├── package.json
│   └── ...
│
└── README.md
```

---

# Environment Variables

Do not commit real credentials.

Create `.env` locally and keep `.env` in `.gitignore`.

The backend uses environment variables for sensitive configuration.

Example:

```env
NODE_ENV=development

PORT=5000

MONGODB_URI=

QR_BASE_URL=https://qr.yourdomain.com

ACCESS_TOKEN_SECRET=
ACCESS_TOKEN_EXPIRES_IN=15m

REFRESH_TOKEN_EXPIRES_IN=7d

ADMIN_FRONTEND_URL=

# Email provider / Gmail OAuth2
GOOGLE_USER=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
```

Only include the variables actually required by the current implementation.

---

# Local Development

## Backend

```bash
cd backend
npm install
npm run dev
```

The exact development command depends on the scripts defined in `package.json`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs separately from the backend during development.

---

# QR Generation Example

The QR generator creates a code containing the Tap2Rate URL:

```text
https://qr.yourdomain.com/q/X91mQa
```

It does NOT contain:

```text
https://g.page/r/XXXXXXXX/review
```

The Google Review destination is stored in MongoDB.

Example React usage with `qrcode.react`:

```jsx
import { QRCodeSVG } from "qrcode.react";

<QRCodeSVG
  value="https://qr.yourdomain.com/q/X91mQa"
  size={300}
/>
```

SVG is preferred for printable QR codes because it can scale without becoming blurry.

---

# PWA

The admin dashboard is designed to work well on mobile devices.

The frontend can be installed as a Progressive Web App.

The goal is:

```text
Open Tap2Rate on phone
        ↓
Add to Home Screen
        ↓
Tap2Rate appears like an app
        ↓
Admin Dashboard
```

The PWA is primarily for the administrator.

Offline functionality is not a core requirement because QR management requires communication with the backend and database.

---

# Security Principles

Tap2Rate follows several security practices:

* HTTPS in production
* bcrypt password hashing
* HttpOnly refresh-token cookies
* Secure cookies in production
* SameSite cookie protection
* Short-lived access tokens
* Refresh-token rotation
* Refresh-token reuse detection
* Server-side session revocation
* Input validation
* Rate limiting on authentication endpoints
* Restricted CORS
* Helmet/security middleware
* No public registration
* Sensitive configuration stored in environment variables
* No secrets committed to source control
* Public QR endpoint isolated from admin authentication

---

# Important Route Separation

The application has two completely different types of requests.

## Customer

```text
GET /q/:qrId
```

Authentication:

```text
NOT REQUIRED
```

Purpose:

```text
QR → Google Reviews
```

## Admin

```text
/api/qr/*
/auth/*
```

Authentication:

```text
REQUIRED where appropriate
```

Purpose:

```text
Manage QR codes and businesses
```

This separation is intentional.

---

# Future Improvements

Potential future features include:

* QR scan analytics
* Total scans per QR
* Daily/monthly scan charts
* Last scan timestamps
* Business management
* Bulk QR generation
* Bulk QR export
* Printable QR templates
* QR branding/customization
* Multiple administrators
* Two-factor authentication
* Advanced audit logs
* QR expiration
* Business-specific dashboards

These should only be added when they are actually required.

---

# Architecture

Current target architecture:

```text
                         Internet
                            │
                            ▼
                     Custom Domain
                            │
                            ▼
                          Vercel
                    ┌───────┴────────┐
                    │                │
                    ▼                ▼
              React Admin        API/Functions
                    │                │
                    └───────┬────────┘
                            ▼
                     MongoDB Atlas
                            │
                            ▼
                    Google Review URL
```

Customer:

```text
Customer
   │
   │ Scan physical QR
   ▼
qr.yourdomain.com/q/X91mQa
   │
   ▼
Vercel API
   │
   ▼
MongoDB Atlas
   │
   ▼
302 Redirect
   │
   ▼
Google Reviews
```

---

# Deployment

The initial production deployment is intended to use:

### Frontend / API

Vercel

### Database

MongoDB Atlas

### Email

Configured email provider using Nodemailer.

### Domain

A custom domain is recommended.

For example:

```text
qr.yourdomain.com
```

Physical QR codes should use the custom domain rather than a provider-specific deployment URL.

This allows the hosting provider to change later without requiring the physical QR codes to be reprinted.

---

# Development Philosophy

Tap2Rate is intentionally designed as a small and efficient application.

The initial system does not require:

* ECS
* Fargate
* EC2
* ALB
* Redis
* Kubernetes
* LangChain
* Microservices

The goal is to keep infrastructure inexpensive and the application easy to understand and maintain.

---

# License

This project is currently a private/project application.

Add an appropriate license here if the project is later made public.
