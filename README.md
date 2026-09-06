# Petzi Backend

NestJS backend for **Petzi** — a pet care mobile app with phone-based authentication and Google OAuth.

## Features

- **Registration flow**:
  1. Send OTP to mobile number
  2. Verify OTP → receive short-lived `registrationToken`
  3. Submit profile + password with the registration token
- **Login flow**: Mobile OTP verification
- **Google OAuth** login (one-time exchange code → access token)
- Soft-delete account with password, delete OTP, or fresh Google exchange code
- JWT-based session management
- Persian validation error messages
- Mock SMS in development (OTP logged to console)
- Rate-limited OTP endpoints with one-time, hashed verification codes
- Private, authenticated pet-document downloads
- Swagger / OpenAPI docs at `/api/docs`

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Docker and Docker Compose (optional)

## Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Create PostgreSQL database
createdb petzi

# Start development server
npm run start:dev
```

API base URL: `http://localhost:3000/api/v1`

Swagger UI: `http://localhost:3000/api/docs`

## Docker

Copy `.env.example` to `.env`, then start Postgres and the API:

```bash
cp .env.example .env
docker compose up --build
```

Hot-reload development stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Stop containers:

```bash
docker compose down
```

Postgres data and uploaded profile pictures are stored in named Docker volumes.

Postgres is **not** exposed on `localhost:5432` by default (avoids conflicts with a local PostgreSQL install or Windows port restrictions). The API connects to it over the Docker network. To access the DB from your machine, uncomment the `ports` section in `docker-compose.yml` and use host port `5433`.

## Swagger

After starting the server, open [http://localhost:3000/api/docs](http://localhost:3000/api/docs).

Use **Authorize** in Swagger UI and paste the `accessToken` from login or registration.

Authorization is persisted in the browser for that session.

## Environment Variables

See `.env.example` for all options. Key variables:

| Variable | Description |
|----------|-------------|
| `DB_*` | PostgreSQL connection |
| `DB_SYNCHRONIZE` | Auto-create tables (`true` only for local development) |
| `JWT_SECRET` | JWT signing secret |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

## API Endpoints

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |

### Registration
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register/send-otp` | — | Send registration OTP |
| POST | `/api/v1/auth/register/verify-otp` | — | Verify OTP → `registrationToken` |
| POST | `/api/v1/auth/register` | — | Complete registration (token + profile + password) |

### Login
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/login/send-otp` | — | Send login OTP |
| POST | `/api/v1/auth/login/verify-otp` | — | Verify OTP, get access token |

### OAuth & Profile
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/auth/google` | — | Redirect to Google login |
| GET | `/api/v1/auth/google/callback` | — | Google OAuth callback (`?code=` one-time) |
| POST | `/api/v1/auth/google/exchange` | — | Exchange Google one-time code for access token |
| GET | `/api/v1/auth/me` | Access token | Get current user profile |
| POST | `/api/v1/auth/me/delete/send-otp` | Access token | Send delete-account OTP |
| DELETE | `/api/v1/auth/me` | Access token | Soft-delete (password, OTP, or Google exchange) |

### Pets
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/pets` | Access token | Create draft pet |
| GET | `/api/v1/pets` | Access token | List pets (`?status=draft\|active`) |
| GET | `/api/v1/pets/{id}` | Access token | Get pet (draft or active) |
| PATCH | `/api/v1/pets/{id}` | Access token | Partial update — send any fields |
| POST | `/api/v1/pets/{id}/vaccines` | Access token | Add vaccine |
| POST | `/api/v1/pets/{id}/documents` | Access token | Upload documents |
| GET | `/api/v1/pets/{id}/documents/{documentId}/download` | Access token | Download a private document |
| POST | `/api/v1/pets/{id}/submit` | Access token | Submit form → active |
| DELETE | `/api/v1/pets/{id}` | Access token | Delete draft |

## Example: Full Registration

```bash
# 1. Send OTP
curl -X POST http://localhost:3000/api/v1/auth/register/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "09123456789"}'

# 2. Verify OTP → registrationToken
curl -X POST http://localhost:3000/api/v1/auth/register/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "09123456789", "code": "123456"}'

# 3. Complete registration with registrationToken
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "09123456789",
    "registrationToken": "<token from step 2>",
    "fullName": "علی محمدی",
    "email": "ali@example.com",
    "dateOfBirth": "1990-01-15",
    "password": "SecurePass1!"
  }'
```

## Project Structure

```
src/
├── common/           # Enums, validators
├── config/           # Environment configuration
├── modules/
│   ├── auth/         # Authentication (register, login, OAuth)
│   ├── users/        # User entity & service
│   ├── otp/          # OTP generation & verification
│   ├── sms/          # SMS delivery (mock in dev)
│   └── pets/         # Pet drafts, vaccines, and private documents
├── app.module.ts
└── main.ts
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Run compiled app |
| `npm run test` | Run unit tests |
