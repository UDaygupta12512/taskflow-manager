# TaskFlow Manager

A full-stack task manager for the intern assignment. Users register and log in with **JWT access tokens** and **server-side refresh sessions**, then manage tasks across **Todo**, **In Progress**, and **Done** on a drag-and-drop kanban board.

## Live deployment

| Project | URL |
|---------|-----|
| Full Stack App | _Add your Render URL after deploy_ |

## Features

### Core (assignment)
- **Auth** — Register, login, logout
- **Tasks** — Create, update, delete; three stages
- **UI** — Responsive dark theme, loading overlay, toast notifications, error handling

### Bonus (implemented)
- **Custom REST APIs** — Structured Express routes (`/api/auth/*`, `/api/tasks/*`, stats, stage patch)
- **Database** — SQLite via `better-sqlite3` (`users`, `tasks`, `sessions` tables)
- **JWT + Sessions** — Short-lived access JWT (15m) + refresh tokens stored in DB (7d), revocable on logout

### UI extras
- Kanban board with **drag-and-drop** between columns
- **Stats dashboard** (total + per-stage counts)
- **Search** tasks by title/description
- Task **priority** (Normal / High / Urgent)
- Modal create/edit flow

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend  | Node.js, Express |
| Database | SQLite (`backend/data/taskflow.db`) |
| Auth     | `jsonwebtoken` + `bcryptjs` + `sessions` table |

## Project structure

```
INDPRO/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── config.js
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── app.js
│   │   ├── config.js
│   │   ├── db/database.js
│   │   ├── middleware/auth.js
│   │   ├── routes/
│   │   └── services/
│   ├── data/              # SQLite file (created at runtime)
│   ├── package.json
│   └── .env.example
└── render.yaml
```

## Run locally

```bash
cd backend
cp .env.example .env   # optional; defaults work for local dev
npm install
npm run dev
```

Open `http://localhost:4000` in your browser. The backend automatically serves the frontend!

## API reference

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | `{ name, email, password }` |
| POST | `/api/auth/login` | Returns `accessToken`, `refreshToken`, `user` |
| POST | `/api/auth/refresh` | `{ refreshToken }` → new access token |
| POST | `/api/auth/logout` | `{ refreshToken }` — revokes session |
| POST | `/api/auth/logout-all` | Bearer — revoke all user sessions |
| GET | `/api/auth/me` | Bearer — current user profile |

### Tasks (Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List tasks (`?stage=`, `?search=`) |
| GET | `/api/tasks/stats/summary` | Counts by stage |
| GET | `/api/tasks/:id` | Single task |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Full update |
| PATCH | `/api/tasks/:id/stage` | `{ stage }` only |
| DELETE | `/api/tasks/:id` | Delete task |

Valid stages: `Todo`, `In Progress`, `Done`.

## Deployment (Single Platform via Render)

The Express backend automatically serves the frontend, meaning the entire application can be deployed as a single Web Service on Render.

1. Push your code to GitHub.
2. Go to [Render.com](https://render.com) and create a **New Web Service**.
3. Connect your repository. Render will automatically detect the `render.yaml` blueprint.
4. Click **Apply**. Render will build and deploy the app.
5. The URL Render provides will host both your frontend interface and backend API!

## Assumptions

- One active browser session per user; tokens stored in `localStorage`.
- Email is unique; password minimum 6 characters.
- Tasks are scoped per user; no shared boards.
- Access tokens expire in 15 minutes; client auto-refreshes using refresh token.

## Tradeoffs

| Decision | Why | Cost |
|----------|-----|------|
| SQLite | Simple, file-based, no external DB setup | Single-server; use persistent disk on PaaS |
| Vanilla frontend | No build step, fast iteration | Less component structure than React |
| localStorage tokens | Easy static hosting | XSS risk — use HTTPS in production |
| 15m access / 7d refresh | Balance security vs UX | Extra refresh call on expiry |

## Technical decisions

1. **Sessions table** stores hashed refresh tokens so logout and server-side revocation work (not purely stateless JWT).
2. **`PATCH /stage`** supports drag-and-drop without sending full task body.
3. **`GET /stats/summary`** powers the dashboard without client-side aggregation.

## License

MIT
