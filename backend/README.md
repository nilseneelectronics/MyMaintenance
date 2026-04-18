# Backend (Phase 1)

This backend is the first cleanup step toward a proper frontend/backend split while preserving the current UI.

## Run

From project root:

`node backend/server.js`

Server default URL:

`http://localhost:3000`

## Default Admin Login

- Email: `admin@mymaintenance.local`
- Password: `admin123`

You can override these with environment variables:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Available API Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
