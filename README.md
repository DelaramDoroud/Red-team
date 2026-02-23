# CodyMatch

![CodyMatch](red-capstone.png)

CodyMatch is a competitive programming platform for education. Teachers create timed challenges, students submit solutions, peer-review each other, and receive calculated scores plus rewards.

**Project**: Red Team Capstone  
**Product Owner**: @SepidehMot Sepideh Mottaghi
**Scrum Master**: @DelaramDoroud Delaram Doroudgarian  
**Jira Project**: [RT - Red](https://capstone-red-team.atlassian.net/jira/software/projects/RT)

## Quick Links

- Developer handbook (deep technical guide): `docs/DEVELOPER_HANDBOOK.md`
- Setup details: `SETUP.md`
- Docker helper commands: `docker/README.md`

## TL;DR (Run Locally)

```bash
./setup.sh
cd docker
./codymatch.sh bul
```

Default development URLs:

- Frontend: `http://localhost:3002`
- Backend API: `http://localhost:3001`
- PostgreSQL (host): `localhost:5431`

## Demo Accounts

Seeded users include:

- Teacher: `teacher1@codymatch.test` / `password123`
- Student: `student1@codymatch.test` / `password123`

(See `backend/models/user.js` for full seeded list.)

## System Architecture

CodyMatch runs as containerized services:

- Frontend: React 19 + React Router + Redux Toolkit (`frontend/`)
- Backend: Node.js + Express 5 + Sequelize (`backend/`)
- DB: PostgreSQL 16
- Session store: Redis 7
- Code execution: Dockerized compilers image (`judge0/compilers`), queued with PgBoss

Realtime updates use SSE (`/api/rest/events`) and are consumed in frontend Redux (`frontend/assets/js/store/SseManager.jsx`).

## Core Domain and Lifecycle

Main entities:

- Challenge
- Match Setting
- Match
- Submission
- Peer Review Assignment
- Peer Review Vote
- Submission Score Breakdown
- Badge / Title

Challenge status flow:

`private -> public -> assigned -> started_coding_phase -> ended_coding_phase -> started_peer_review -> ended_peer_review`

Scoring status flow (separate field):

`pending -> computing -> completed`

## Repository Structure

```text
codymatch/
├── backend/        # Express API, services, models, migrations, tests
├── frontend/       # React app, Redux store, route pages, tests
├── docker/         # Compose files and codymatch.sh helper
├── docs/           # Extended project documentation
├── setup.sh        # Environment bootstrap script
├── SETUP.md        # Setup instructions
└── README.md
```

## Development Workflow

1. Run bootstrap:

```bash
./setup.sh
```

2. Start development stack:

```bash
cd docker
./codymatch.sh bul
```

3. Use Docker helper for package operations:

```bash
./codymatch.sh backend npm install <package>
./codymatch.sh frontend npm install <package>
```

## Testing

From `docker/`:

```bash
# Full suite (backend + frontend)
./codymatch.sh test --stop

# Backend only
./codymatch.sh backend test --stop

# Frontend only
./codymatch.sh frontend test --stop
```

## Linting and Formatting

From `docker/`:

```bash
./codymatch.sh lint
```

This runs backend and frontend lint pipelines (Biome, Stylelint, Markdownlint where configured).

## Database Migrations

From `docker/`:

```bash
./codymatch.sh migrate
./codymatch.sh migrate-undo
./codymatch.sh migrate-undo-all
./codymatch.sh migration:new your_migration_name
```

## Environment Variables

Template:

- `docker/example.env`

Auto-generated on setup (if missing):

- `docker/.env`
- `backend/tests/.env.test`

Important variables include:

- `ENVIRONMENT`
- `PROJECT_PORT`
- `DB_PORT`, `DB_PASSWORD`
- `SECRET`
- `REDIS_URL`
- `CORS_ALLOWED_ORIGINS`
- `VITE_API_REST_BASE`
- `VITE_AUTH_API_BASE`
- `CODE_RUNNER_IMAGE`

## Production Notes

Production compose overlay:

- `docker/docker-compose-production.yml`

Deployment helper:

- `docker/deploy.sh`

Production routing is configured with Traefik labels in compose files.

## Exam and Handoff Guidance

For technical discussion, architecture walkthroughs, and “change this feature” requests, use:

- `docs/DEVELOPER_HANDBOOK.md`

It documents:

- backend/frontend runtime internals
- route and service map
- scoring/review algorithms
- common modification playbooks
- deployment handoff checklist

## Maintainers

Capstone Red Team.

