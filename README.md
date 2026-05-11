# MRD Online Clinic — Backend (MVP)

Telemedicine REST + Socket.IO API built with Node.js, TypeScript (strict), Express, MongoDB/Mongoose, JWT auth, and Zod validation.

## Requirements

- Node.js 20+
- MongoDB 6+

## Setup

```bash
cp .env.example .env
# Edit .env — set MONGODB_URI, JWT secrets (32+ chars), optional SEED_SUPERADMIN_*, SMTP, ImageKit
npm install
npm run dev
```

- HTTP: `http://localhost:3000` (or `PORT`)
- Health: `GET /health`
- API base: `/api/v1`

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | `tsx watch` development  |
| `npm run build`| Compile to `dist/`       |
| `npm start`    | Run compiled server      |
| `npm test`     | Jest tests               |
| `npm run lint` | ESLint on `src/`         |

## Architecture

Feature modules live under `src/modules/*` (models, services, controllers, routes, validation). Cross-cutting pieces are in `src/config`, `src/middlewares`, `src/services`, `src/sockets`, `src/events`, and `src/shared`.

## Testing

Tests assume MongoDB at `MONGODB_URI` (default `mongodb://127.0.0.1:27017/mrdonlineclinic_test`). Override in the environment or in `tests/setup.ts` if needed.

```bash
npm test
```

## Security notes

- Refresh tokens are stored hashed; access tokens are short-lived JWTs.
- CORS is open (any `Origin` is reflected); set `CLIENT_URL` to the public SPA base URL for email and invite links.
- Use strong JWT secrets in production; rotate by deploying new secrets and invalidating old refresh tokens.
