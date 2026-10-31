# Smart Tech Lab

Smart Tech Lab is a React/Vite coding platform backed by Express, MongoDB/Mongoose, Redis, cookie-based JWT authentication, Judge0 and Monaco Editor.

## Local development

1. Copy `.env.example` to `.env` and set at least `DB_CONNECT_STRING`, `JWT_KEY`, and either `JUDGE0_API_KEY` or `JUDGE0_API_URL`.
2. Install dependencies with `npm install`, `npm install --prefix src` and `npm install --prefix Frontend/frontend`.
3. Start the API with `npm start`.
4. In another terminal, start the frontend with `npm run dev --prefix Frontend/frontend`.
5. Run the targeted examination rule tests with `npm test`; create a production frontend bundle with `npm run build`.

The API listens on port 3000 by default. In production it is mounted under `/api`. Redis remains optional for local development; with Redis connected, exam code evaluation requests use shared per-user rate-limit counters. Existing authentication still uses the `token` HTTP-only cookie.

Code execution needs an external Judge0 service. For RapidAPI, set `JUDGE0_API_KEY` (or legacy `RAPIDAPI_KEY`) and optionally `JUDGE0_API_HOST`. For a self-hosted Judge0 CE endpoint, set `JUDGE0_API_URL` (for example `http://127.0.0.1:2358`); if authentication is enabled, set `JUDGE0_AUTH_TOKEN` and optionally `JUDGE0_AUTH_HEADER` (defaults to `X-Auth-Token`). The server loads the project root `.env`, then falls back to `src/.env`, while real process environment values take precedence. No API key is bundled in the repository. Restart the API after changing environment variables.

Docker Compose passes MongoDB, Redis, Judge0 and existing platform configuration into the app container. Use the root `.env.example` as a checklist; production secrets should be supplied through deployment environment settings.

## Lab examinations

Lab examinations are integrated into the existing app. Teachers and administrators use **Lab Examinations** from the dashboard; students use **Lab Practicals**.

### Data model

- `LabExam` stores ownership, schedule, student/group targeting, duration, attempts, proctoring settings and lifecycle status.
- `ExamQuestion` stores an exam-specific snapshot of each selected bank question or a custom question. It contains hidden tests only on the server and does not store or expose reference solutions.
- `ExamAttempt` stores server start/deadline times, per-language drafts, current status and server-computed scores.
- `ExamSubmission` stores submitted code and verified Judge0 results separately from regular practice submissions.
- `ProctoringEvent` stores the event type, backend-computed severity, server receipt time and bounded metadata.

Question-bank problems are copied into an examination snapshot at creation so edits to the regular question bank do not silently change a scheduled exam. Hidden test cases and reference solutions are excluded from every student-facing exam response. Run requests receive only visible cases; submit requests are evaluated against hidden cases on the server. Exam submissions are limited to 12 code-run or submit requests per user per minute and attempt, using Redis when available.

Lifecycle status is derived and synchronized from server timestamps: `DRAFT`, `SCHEDULED`, `ACTIVE`, `COMPLETED` and `CANCELLED`. A periodic server worker expires attempts, records final status and evaluates saved drafts when automatic submission is enabled. Students can reconnect to the same active attempt. Attempt creation and pending submissions have MongoDB unique indexes to protect against duplicate joins and simultaneous submissions.

### HTTP API

All routes use the existing authenticated cookie. Teacher routes accept `teacher` or `admin`; teachers can manage only examinations they created, while administrators can manage all examinations.

| Method and path | Purpose |
| --- | --- |
| `GET /lab-exams` | List eligible student exams or managed exams; supports `page` and `limit` |
| `POST /lab-exams` | Create a draft from bank question IDs and/or custom question objects |
| `GET /lab-exams/:examId` | Read exam instructions and safe metadata |
| `PUT /lab-exams/:examId` | Update details and, before start, question snapshots |
| `DELETE /lab-exams/:examId` | Delete before start if no attempt exists |
| `POST /lab-exams/:examId/publish` / `unpublish` | Publish or withdraw a scheduled exam before it starts |
| `POST /lab-exams/:examId/cancel` | Cancel a scheduled or active examination |
| `POST /lab-exams/:examId/join` | Start or resume an eligible attempt during the exam window |
| `GET /lab-exams/attempts/:attemptId` | Read the owner’s safe attempt state, questions, drafts and submission history |
| `PUT /lab-exams/attempts/:attemptId/drafts/:questionId` | Save a draft after checking ownership, membership and deadline |
| `POST /lab-exams/attempts/:attemptId/heartbeat` | Refresh server-side participant connection activity |
| `POST /lab-exams/attempts/:attemptId/questions/:questionId/run` | Run against visible test cases through the existing Judge0 utility |
| `POST /lab-exams/attempts/:attemptId/questions/:questionId/submit` | Evaluate hidden tests and calculate marks on the server |
| `POST /lab-exams/attempts/:attemptId/finish` | Finish an attempt; automatically evaluates saved drafts when configured |
| `POST /lab-exams/attempts/:attemptId/proctoring-events` | Record a configured browser monitoring event using server receipt time |
| `GET /lab-exams/:examId/participants` | View paginated participant and connection status (teacher/admin) |
| `GET /lab-exams/:examId/results` | View paginated scores and submitted code (teacher/admin) |
| `GET /lab-exams/:examId/results.csv` | Export results as CSV (teacher/admin) |
| `GET /lab-exams/:examId/proctoring-events` | Review paginated monitoring signals (teacher/admin) |

Create/update requests take ISO timestamps, `questions` as an ordered array (`{ problemId, marks }` for a bank question or a custom question with description, visible/hidden test arrays and optional starter code), and optional proctoring configuration. The current UI also accepts target student MongoDB IDs and target group names. Student records may include `semester`, `batch` and `studentGroup` for eligibility filtering.

### Proctoring and monitoring limits

The browser reports enabled tab, focus, clipboard, context-menu, fullscreen, route change, device-disconnect, connection and supported face/audio activity signals. An active exam is pinned to its route in the application; navigating away records a server event and, by default, immediately terminates the attempt. Teachers can disable route termination and configure a separate violation threshold (minimum three events) that terminates the attempt. The server sets event receipt times and atomically updates violation counts/status, then makes terminated attempts read-only. The first signal warns, the second is stronger, and later signals flag the attempt. Camera, face and basic audio checks run locally; raw video/audio is not uploaded or stored. Face presence uses the browser `FaceDetector` API only when available and otherwise reports an unsupported-browser message. Browser fullscreen requires user interaction and can be exited with browser/system controls; browser signals cannot block all OS shortcuts, external devices, virtual machines or alternate devices. Treat them as monitoring evidence for instructor review, not conclusive proof by themselves.

The instructor monitoring screen refreshes participant, result and event tables every five seconds. Participant connection status uses a heartbeat; an attempt without activity for 45 seconds is shown as disconnected.

## 1v1 Battle Arena

Students can enter from **Battle Arena** on the dashboard, match with another student using the same settings, or send a two-minute friend invitation. Both competitors receive the same question snapshots and timer, with private editor drafts. Matchmaking uses Redis atomic queue operations; friend matches also use Redis player reservations. Redis is optional for the rest of local development, but random matchmaking, accepting friend matches, leaderboards and cross-instance Socket.IO fan-out require Redis to be connected.

Each question needs hidden test cases in the problem bank. Run requests use visible cases; submissions use hidden cases through the shared Judge0 integration. The server awards points once per solved question, applies a capped incorrect-submission penalty, tracks the match timer and connection timeout, computes the result and updates battle history and ratings. Source code and drafts are only returned to the player who owns them.

### HTTP API

All routes are under `/battle`, require the existing student cookie session and only allow `user` accounts.

| Method and path | Purpose |
| --- | --- |
| `GET /battle/students?q=...` | Search students to challenge |
| `GET /battle/invitations` | List incoming and outgoing invitations |
| `POST /battle/invitations` | Send a friend invitation |
| `POST /battle/invitations/:invitationId/accept` / `reject` | Respond to an invitation |
| `POST /battle/matchmaking/find` / `cancel` | Join or leave a Redis matchmaking queue |
| `GET /battle/active` | Resume an active battle |
| `GET /battle/:battleId` | Load a battle the current user joined |
| `POST /battle/:battleId/join` | Restore player connection status |
| `PUT /battle/:battleId/drafts/:questionId` | Save the current user’s private draft |
| `POST /battle/:battleId/questions/:questionId/run` | Run visible tests |
| `POST /battle/:battleId/questions/:questionId/submit` | Evaluate hidden tests and update server score |
| `POST /battle/:battleId/cancel` | Cancel a match before its countdown ends |
| `GET /battle/:battleId/leaderboard` | View scores for the current battle |
| `GET /battle/leaderboard?period=global\|weekly` | View the global or weekly leaderboard |
| `GET /battle/history` | View personal stats and completed matches |

The authenticated Socket.IO namespaces are `/battle` and `/exams`. `/battle` emits `battle:matched`, `battle:countdown`, `battle:started`, `battle:score`, `battle:presence`, `battle:invitation`, and `battle:completed`. Battle room membership is checked against persisted players. `/exams` lets authorized teachers/admins join an exam monitoring room and emits `exam:activity` for joins, reconnects, submissions, proctoring events, disconnections, expiry and cancellation; ownership is checked before joining. The Redis adapter fans events across server instances. Exam monitoring also refreshes over HTTP every five seconds when a socket reconnects.

Redis stores matchmaking queues as sorted sets at `battle:queue:<subject>:<difficulty>:<duration>:<questionCount>:<topic>` with a companion `:meta` hash, per-user queue pointers at `battle:queue:user:<userId>`, active reservations and battle locks under `battle:player:<userId>` and `battle:lock:<battleId>`, and leaderboard sorted sets at `battle:leaderboard:global`, `battle:leaderboard:weekly:<ISO-week>` and `battle:leaderboard:<battleId>`. MongoDB remains the source for invitation records, completed battles, submissions and student stats. Redis host, port, password, username and TLS settings are documented in `.env.example`.

## Existing features

Regular problem creation, practice submissions, assignments, auth and subject routes stay on their existing models and APIs. Exam and battle code execution call the shared `src/utils/problemUtility.js` Judge0 integration instead of introducing another execution service.

## Remaining requested work

The examination and Battle Arena slices are implemented. Browser proctoring remains bounded by available browser APIs. Automated tests cover exam lifecycle, eligibility, deadline/grace, hidden-test serialization, proctoring severity and termination policy, teacher authorization, Judge0 configuration, battle configuration, pair membership, scoring and winner selection. Database-backed concurrency, live Judge0 evaluation and full browser/API flows still require configured MongoDB, Redis, a Judge0 service and an integration-test environment.
