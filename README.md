# Padikonect

Lagos-based social/local-discovery app — discover hangouts, connect with new padis, and build a circle around drink culture (alcoholic and non-alcoholic).

## Structure

- `backend/` — NestJS API (PostgreSQL + PostGIS, Redis, Socket.IO, Cloudinary, Paystack/Flutterwave, Google Maps).
- `frontend/` — Next.js web client.

Each has its own `README`/`package.json` and is run independently — see `backend/docs/` for the full architecture plan and `backend/.env.example` / `frontend/.env.example` for required environment variables.
