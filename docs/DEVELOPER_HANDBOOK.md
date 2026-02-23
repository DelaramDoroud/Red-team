# CodyMatch Developer Handbook

This handbook is the technical reference for:

- Understand architecture, code flows, and change points.
- Future developers who will maintain and deploy CodyMatch on university infrastructure.

Use this together with `README.md` (quick start) and the source code.

## 1. Product and Scope

CodyMatch is a coding challenge platform with two main roles:

- `teacher`/`admin`: create and manage challenges and match settings, run challenge phases, monitor results.
- `student`: join challenges, solve coding tasks, do peer review, and see scores/rewards.

The platform centers around a challenge lifecycle:

1. Challenge setup (private/public)
2. Student joining
3. Match assignment
4. Coding phase
5. Coding phase finalization
6. Peer-review assignment
7. Peer-review phase
8. Scoring/results and rewards

## 2. Runtime Architecture

## 2.1 Services

CodyMatch runs as multiple containers:

- Frontend: React SPA (Vite) on port `3002` in dev.
- Backend: Express API on port `3001`.
- PostgreSQL: main relational database (`postgres:16-alpine`).
- Redis: session store (`redis:7-alpine`).
- Code execution image puller: ensures `judge0/compilers:latest` image is available.

Key compose files:

- Base services: `docker/docker-compose.yml`
- Dev overrides: `docker/docker-compose-development.yml`
- Test overrides: `docker/docker-compose-test.yml`
- Production overrides: `docker/docker-compose-production.yml`

## 2.2 Request and Event Flow

- Browser calls REST API under `/api/rest/*`.
- Authentication endpoints are under `/api/*`.
- Realtime updates use SSE at `/api/rest/events`.
- Backend broadcasts challenge/finalization events via `backend/services/event-stream.js`.
- Frontend listens through Redux-managed SSE in `frontend/assets/js/store/SseManager.jsx`.

## 2.3 Backend Boot Sequence

Main boot files:

- `backend/app.js`
- `backend/app_initial.js`

Boot behavior (`backend/app_initial.js`):

1. Validate security env (CORS origins, `SECRET`, Redis URL in non-test).
2. Initialize middleware (`helmet`, `cors`, `morgan`, `express.json`, `express-session`).
3. Register routers from `backend/routes/index.js`.
4. Initialize models and relations (`backend/models/init-models.js`).
5. Run migrations (automatically in non-test, and optionally in test via env).
6. Seed data in non-test mode (users, titles, badges, etc.).
7. Restore challenge timers for in-progress phases.
8. Initialize code-execution queue and worker (unless disabled by env flags).

## 3. Tech Stack and Conventions

Frontend (`frontend/package.json`):

- React 19, React Router 7
- Redux Toolkit + Redux Persist
- Vite 7
- Vitest + Testing Library
- Biome + Stylelint + Markdownlint

Backend (`backend/package.json`):

- Node.js (ESM)
- Express 5
- Sequelize + Umzug migrations
- PgBoss queue for code execution jobs
- Redis-backed sessions (non-test)
- Vitest + Supertest
- Biome + Markdownlint

Global conventions:

- Functional style preferred (no class-heavy frontend logic).
- Redux state for client persistence and cross-page state.
- JSON schema validation (AJV) for challenge payloads.
- Containerized workflows via `docker/codymatch.sh`.

## 4. Repository Map

Top-level important paths:

- `backend/`: API, models, services, migrations, tests.
- `frontend/`: React app, feature modules, store, tests.
- `docker/`: compose files, orchestration script, deployment helpers.
- `docs/`: long-form documentation (this file).
- `README.md`: quick start and operational index.

## 5. Domain Model

Main entities (Sequelize models):

- `Challenge` (`backend/models/challenge.js`)
- `MatchSetting` (`backend/models/match-setting.js`)
- `ChallengeMatchSetting` (`backend/models/challenge-match-setting.js`)
- `ChallengeParticipant` (`backend/models/challenge-participant.js`)
- `Match` (`backend/models/match.js`)
- `Submission` (`backend/models/submission.js`)
- `PeerReviewAssignment` (`backend/models/peer_review_assignment.js`)
- `PeerReviewVote` (`backend/models/peer-review-vote.js`)
- `SubmissionScoreBreakdown` (`backend/models/submission-score-breakdown.js`)
- `Badge`, `StudentBadge`, `Title`, `User`

### 5.1 Challenge Status Machine

Current enum values (`backend/models/enum/enums.js`):

- `private`
- `public`
- `assigned`
- `started_coding_phase`
- `ended_coding_phase`
- `started_peer_review`
- `ended_peer_review`

Typical transition path:

1. `private`
2. `public`
3. `assigned`
4. `started_coding_phase`
5. `ended_coding_phase`
6. `started_peer_review`
7. `ended_peer_review`

Related scoring flag on challenge:

- `scoringStatus`: `pending | computing | completed`

### 5.2 Submission Status Semantics

`Submission.status`:

- `wrong`
- `improvable`
- `probably_correct`

Final submission selection per match uses `backend/services/submission-finalization.js`:

- Manual and automatic submissions are compared.
- Higher status rank wins (`probably_correct` > `improvable` > `wrong`).
- Winner becomes `isFinal = true`.

## 6. Backend API Surface

Router registration entry: `backend/routes/index.js`.

API groups:

- Auth/config: `backend/routes/api/*`
- Challenge domain: `backend/routes/rest/challenge-controller.js` + `challenge/routes/*`
- Match settings: `backend/routes/rest/match-setting-controller.js`
- Submissions/runs: `backend/routes/rest/submission-controller.js`, `backend/routes/rest/run-controller.js`
- Peer review: `backend/routes/rest/peer-review-controller.js`
- Rewards/profile: `backend/routes/rest/reward-controller.js`, `backend/routes/rest/profile-controller.js`
- Event stream: `backend/routes/rest/events-controller.js`

High-value endpoints to now:

- `POST /api/login`, `POST /api/logout`, `GET /api/userinfo`
- `GET /api/rest/challenges`
- `POST /api/rest/challenges`
- `POST /api/rest/challenges/:challengeId/publish`
- `POST /api/rest/challenges/:challengeId/assign`
- `POST /api/rest/challenges/:challengeId/start`
- `POST /api/rest/challenges/:challengeId/end-coding`
- `POST /api/rest/challenges/:challengeId/peer-reviews/assign`
- `POST /api/rest/challenges/:challengeId/peer-reviews/start`
- `POST /api/rest/challenges/:challengeId/end-peer-review`
- `GET /api/rest/challenges/:challengeId/results`
- `GET /api/rest/challenges/:challengeId/leaderboard`
- `POST /api/rest/submissions`
- `POST /api/rest/run`
- `GET /api/rest/events`

## 7. Core Business Flows

## 7.1 Match Assignment

Service: `backend/services/assign-matches.js`

- Validates challenge and start timing.
- Loads selected match settings for the challenge.
- Loads joined participants.
- Random-shuffles participants.
- Round-robin assigns participants across available match settings.
- Stores rows in `match` table.

Key output: grouped assignment per `challenge_match_setting`.

## 7.2 Coding Phase Start/End

Start:

- Service `backend/services/start-challenge.js`
- Route `POST /challenges/:challengeId/start`
- Requires challenge already `assigned`.
- Sets start/end coding timestamps and status.

End:

- Auto end by timer in `backend/services/challenge-scheduler.js`.
- Manual end route also available: `POST /challenges/:challengeId/end-coding`.
- Missing submissions are finalized with empty/wrong auto submission when needed.

## 7.3 Coding Phase Finalization

Main file: `backend/services/coding-phase-finalization.js`

Important detail:

- There is an autosubmit grace period of 20 seconds in non-test mode (`CODING_PHASE_AUTOSUBMIT_GRACE_MS`).
- In-flight submission counters prevent premature finalization.
- When ready, challenge gets `codingPhaseFinalizationCompletedAt`.

This is critical because peer review assignment/start checks for finalization completion.

## 7.4 Peer Review Assignment

Service: `backend/services/assign-peer-reviews.js`

Algorithm characteristics:

- Operates per challenge match-setting group.
- Only final valid submissions (`improvable` or `probably_correct`) are reviewable.
- No self-review.
- Uses a max-flow style assignment builder to balance workload.
- Supports “extra” assignments where exact balance is impossible.
- Stores assignments in `peer_review_assignment`.

## 7.5 Peer Review Voting and Exit

Vote endpoint:

- `POST /peer-reviews/:assignmentId/vote`
- Service `backend/services/peer-review-submit-vote.js`

Important validations:

- Incorrect votes must include test case input and expected output.
- Public tests cannot be re-used as “incorrect proof”.
- Test case is executed against submission; invalid bug claims can be rejected.

Exit endpoint:

- `POST /peer-review/exit`
- Saves provided votes and auto-fills missing votes as `abstain`.

## 7.6 Peer Review Finalization

Service: `backend/services/finalize-peer-review.js`

Responsibilities:

- Finalize all incomplete votes with abstain.
- Evaluate correctness of review votes.
- For incorrect votes, run reference solution and optionally run reviewed submission.
- Set fields like `isVoteCorrect`, `isExpectedOutputCorrect`, `isBugProven`, `evaluationStatus`.
- Mark challenge `ended_peer_review`.
- Trigger scoring and badge awarding.

## 7.7 Scoring

Service: `backend/services/scoring-service.js`

Score components:

- Code Review Score (max 50)
- Implementation Score (max 50)

Implementation score logic:

- Base from private teacher tests pass ratio.
- Penalty from failed peer-review bug tests.

Review score formula:

- Uses `E`, `C`, `W`, and total reviewed correct/incorrect counts.
- Clamped to `[0, 50]`.
- Full totals persisted in `submission_score_breakdown` including raw stats.

## 7.8 Rewards and Titles

Badges:

- Seeded in `backend/models/badge.js`
- Award logic in `backend/services/challenge-completed-badges.js`

Titles:

- Seeded in `backend/models/title.js`
- Evaluated in `backend/services/evaluateTitleEligibility.js`
- Endpoint to evaluate and update user title: `POST /api/rest/rewards/evaluate-title`

Profile endpoint:

- `GET /api/rest/students/me/profile`
- Aggregates stats, badges, history, and current/next title.

## 8. Code Execution Pipeline

Files:

- Queue: `backend/services/code-execution-queue.js`
- Worker: `backend/services/code-execution-worker.js`
- Test execution orchestrator: `backend/services/execute-code-tests.js`
- Sandbox runner: `backend/services/code-runner.js`

Execution model:

1. Each test case becomes a queue job.
2. Worker executes code inside Docker (`judge0/compilers` image).
3. Output is polled until complete/failed/timeout.
4. Results are normalized and aggregated.

Security and isolation controls in runner:

- `--network none`
- CPU/memory limits
- read-only root FS with tempfs
- hard timeout handling

## 9. Frontend Architecture

## 9.1 Routing

Main routing file: `frontend/routes.jsx`.

Important route groups:

- Teacher/admin: `/challenges`, `/challenges/:id`, `/match-settings/*`, `/new-challenge`
- Student: `/student/challenges`, `/student/challenges/:challengeId/match`, `/peer-review`, `/result`
- Shared/auth: `/login`, `/forbidden`, `/not-found`

Note:

- Folder names use `app/...` style, but this is not a Next.js app runtime.
- Navigation is driven by React Router.

## 9.2 Global State (Redux)

Store files:

- `frontend/assets/js/store/store.js`
- `frontend/assets/js/store/slices/auth.js`
- `frontend/assets/js/store/slices/events.js`
- `frontend/assets/js/store/slices/ui.js`

Persisted slices (`redux-persist`):

- `auth`
- `ui`

Non-persisted example:

- SSE events slice (`events`) updates in memory.

## 9.3 SSE Integration

Frontend listener:

- `frontend/assets/js/store/SseManager.jsx`

Listened event types:

- `challenge-updated`
- `challenge-participant-joined`
- `finalization-updated`

Consumers subscribe with `useSseEvent` (`frontend/assets/js/useSseEvent.js`).

## 9.4 Data Access Layer

Main API hook:

- `frontend/assets/js/useChallenge.js`

Shared fetch helper:

- `frontend/assets/js/useFetchData.js`

Behavior:

- All requests include credentials (`credentials: 'include'`).
- 401 auto-clears auth state and redirects to `/login`.

## 9.5 Student Match/Peer-Review/Result Flow

Main files:

- Match page components and hooks under `frontend/app/student/challenges/[challengeId]/(components)/`
- Peer review under `frontend/app/student/challenges/[challengeId]/peer-review/`
- Result page under `frontend/app/student/challenges/[challengeId]/result/`

Important runtime details:

- Match page handles run, submit, custom tests, auto-submit-on-timeout.
- Peer review supports autosave, validation, exit flow, and summary.
- Result page handles pending finalization/scoring states and polling until ready.

## 9.6 Teacher Flow

Teacher list and detail:

- `frontend/assets/modules/challenge/list.jsx`
- `frontend/app/challenges/[id]/page.jsx`
- `frontend/app/challenges/[id]/useChallengeDetailPage.jsx`

Capabilities:

- publish/unpublish challenge
- assign participants to matches
- start/end phases
- assign peer reviews
- inspect teacher result panels
- add validated peer-review tests into private tests

## 9.7 Match Setting Authoring

Core module:

- `frontend/assets/modules/match-settings/form.jsx`

Reference solution editor decomposition:

- imports section
- prefix section
- solution body
- suffix section

Markers used when serializing:

- `// __CODYMATCH_IMPORTS_END__`
- `// __CODYMATCH_PREFIX_END__`
- `// __CODYMATCH_SOLUTION_END__`

## 10. Authentication and Authorization

Backend auth:

- Session-based with `express-session`.
- Redis-backed store in non-test.
- Login endpoint validates bcrypt password hashes.

Role guards:

- Backend guards in `backend/services/request-auth.js`
- Frontend route guard hook in `frontend/assets/js/useRoleGuard.js`

Role policy summary:

- Privileged: `teacher`, `admin`
- Student-only areas under `/student/*`

## 11. Validation Strategy

Backend validation layers:

- AJV JSON schemas: `backend/schemas/*.json`
- Domain/service-level validation in controllers/services
- Input normalization utilities in route shared modules

Examples:

- `challenge` vs `challenge-public` schema IDs
- Join payload schema (`join-challenge`)
- Import block restriction for C/C++ marker section (`backend/services/import-validation.js`)

## 12. Database and Migrations

Migration runner:

- `backend/services/migrator.js`
- CLI scripts in `backend/package.json`

Migration count currently: `32` files in `backend/migrations/`.

Latest migration of note:

- `20260210150000-rename-legacy-columns-and-statuses.js`

It normalizes legacy phase column names/status labels to current naming.

## 13. Testing and Quality Gates

Current automated tests:

- Backend test files: `25`
- Frontend test files: `22`

Test commands (via docker helper preferred):

- `./docker/codymatch.sh backend test --stop`
- `./docker/codymatch.sh frontend test --stop`
- `./docker/codymatch.sh test --stop`

Lint command:

- `./docker/codymatch.sh lint`

Git hooks:

- Pre-commit uses `lint-staged`
- Pre-push runs `./docker/codymatch.sh test --stop`

## 14. Environment Variables and Operational Settings

Primary env template: `docker/example.env`.

Important values:

- `ENVIRONMENT=development|test|production`
- `PROJECT_NAME`, `PROJECT_PORT`
- `DB_PORT`, `DB_PASSWORD`
- `SECRET` (session secret, must be strong)
- `REDIS_URL`
- `CORS_ALLOWED_ORIGINS`
- `VITE_API_REST_BASE`, `VITE_AUTH_API_BASE`
- `CODE_RUNNER_IMAGE`
- Queue/worker tuning (`CODE_EXECUTION_CONCURRENCY`, retry settings, retention)

Production compose uses Traefik labels for routing API and frontend.

## 15. Common Change Playbooks (Professor Question Ready)

## 15.1 “Change scoring weights or formula”

Edit:

- `backend/services/scoring-service.js`

Then verify:

- Backend unit/integration tests related to scoring and leaderboard.
- Result and leaderboard pages in frontend.

## 15.2 “Change challenge status behavior or add a new phase rule”

Edit:

- Enum values: `backend/models/enum/enums.js`
- Phase services: `backend/services/start-challenge.js`, `backend/services/start-peer-review.js`, `backend/services/challenge-scheduler.js`
- Route guards/messages: `backend/routes/rest/challenge/routes/*.js`
- Frontend status labels: `frontend/assets/js/constants.js`
- Frontend UI conditionals across challenge/match/peer-review/result pages.

If schema change needed:

- Add migration under `backend/migrations/`

## 15.3 “Change match assignment algorithm”

Edit:

- `backend/services/assign-matches.js`

Optional UI impact:

- Assignment visualization on teacher challenge detail page.

## 15.4 “Change peer-review assignment fairness rule”

Edit:

- `backend/services/assign-peer-reviews.js`

Focus areas:

- reviewer capacity
- submission targets
- no self-review constraints
- extra assignment handling

## 15.5 “Allow/disallow languages or execution limits”

Edit:

- Supported languages/timeouts: `backend/services/code-runner.js`
- Wrappers: `backend/services/wrappers/*`
- Submission/run routes default language assumptions.

## 15.6 “Add a new badge or title tier”

Edit:

- Seed definitions in `backend/models/badge.js` and/or `backend/models/title.js`
- Award/evaluation logic in rewards services
- Optional frontend wording in rewards/profile pages

Also add migration if persistence structure changes.

## 15.7 “Add a new API endpoint”

Recommended sequence:

1. Add route in proper controller module.
2. Add service logic in `backend/services/*` when reusable.
3. Add frontend call in `frontend/assets/js/useChallenge.js` or relevant hook.
4. Add tests for endpoint behavior.

## 16. Known Implementation Notes and Gotchas

- `frontend/services/challengeService.js` contains legacy endpoint strings and is not the main data path. Prefer `useChallenge` hook.
- Frontend route folder names look Next-like but app runs on React Router.
- Challenge finalization and scoring are intentionally asynchronous; UI must handle pending states.
- SSE events are critical to keep teacher and student pages in sync during phase transitions.
- In tests, some timing constants are shortened or zeroed.

## 17. Production Handoff Checklist

Before university deployment:

1. Set secure production env values:
- `SECRET` strong value
- strict `CORS_ALLOWED_ORIGINS`
- database/registry credentials

2. Validate infra assumptions:
- Docker socket access policy for code execution
- resource limits for runner and worker
- persistent volumes for DB/Redis

3. Run quality gates:
- full test suite
- lint/format checks

4. Verify operational behaviors:
- challenge timers after restart
- SSE stream stability under reverse proxy
- scoring completion and leaderboard consistency

5. Prepare rollback strategy:
- database backup
- image tag pinning
- migration rollback plan

## 18. Fast Map

- Login/session: `backend/routes/api/user-controller.js`, `backend/services/session.js`
- Challenge state machine: `backend/models/enum/enums.js`, challenge route modules
- Match assignment: `backend/services/assign-matches.js`
- Peer review assignment: `backend/services/assign-peer-reviews.js`
- Vote validation: `backend/services/peer-review-submit-vote.js`
- Finalization after timer: `backend/services/challenge-scheduler.js`, `backend/services/coding-phase-finalization.js`
- Scoring formula: `backend/services/scoring-service.js`
- Frontend global state: `frontend/assets/js/store/*`
- SSE client wiring: `frontend/assets/js/store/SseManager.jsx`
- Student challenge runtime flow: `frontend/app/student/challenges/[challengeId]/*`
- Teacher challenge orchestration UI: `frontend/app/challenges/[id]/useChallengeDetailPage.jsx`

## 19. Suggested Next Documentation Expansions

For future maintainers, consider adding:

- A database ER diagram generated from models/migrations.
- API contract tables (request/response examples per endpoint).
- Operational runbook with monitoring dashboards and alerting.
- Performance baselines for execution queue throughput.

