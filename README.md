# DevBoard

Real-time project management and engineering dashboard for small engineering teams.

## Problem Statement

Small engineering teams need a lightweight project management tool to track issues, assign work, monitor sprint progress, and collaborate in real time without the overhead of heavier tools like Jira.

DevBoard lets teams create organizations, manage projects, assign issues, track sprint progress, comment on tasks, and view analytics from a clean dashboard.

## Tech Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Recharts
- Backend: Next.js API routes, Prisma ORM
- Database: PostgreSQL
- Auth: NextAuth.js credentials provider
- Realtime: Socket.io

## Five-Day Implementation Plan

### Day 1: Database, Auth, Core Backend

1. Design database schema.
2. Implement Prisma models.
3. Create credentials authentication with NextAuth.
4. Build organization and project APIs.
5. Build issue APIs.
6. Verify APIs with HTTP requests or Postman.

Implemented Day 1 endpoints:

- `POST /api/auth/signup`
- `POST /api/organizations`
- `GET /api/organizations`
- `POST /api/projects`
- `GET /api/projects`
- `POST /api/issues`
- `GET /api/issues`

### Day 2: Backend Business Logic

1. Add role-based access control.
2. Add issue status transition rules.
3. Add assignment rules.
4. Generate activity logs for every meaningful change.
5. Add comments APIs.
6. Add search and filter APIs.

Target endpoints:

- `PATCH /api/issues/:id/status`
- `PATCH /api/issues/:id/assign`
- `POST /api/issues/:id/comments`
- `GET /api/issues/:id/comments`
- `GET /api/projects/:id/activity`
- `GET /api/projects/:id/issues?status=TODO&priority=HIGH`

Implemented Day 2 behavior:

- Organization RBAC with `OWNER`, `ADMIN`, `DEVELOPER`, and `VIEWER` roles.
- Project creation restricted to owners/admins.
- Issue creation restricted to developers and above.
- Issue assignment restricted to owners/admins.
- Status transitions restricted to developers and above, reporters, or assignees.
- Comment creation restricted to developers and above.
- Activity log generation for status changes, assignments, comments, projects, and issues.
- Issue filters for status, priority, assignee, label, and search query.

### Day 3: Frontend MVP

1. Build `/login` and `/signup`.
2. Build `/dashboard`.
3. Build organization and project views.
4. Build issue creation form.
5. Build Kanban board.
6. Build issue detail and comments UI.
7. Build activity feed.

Implemented Day 3 behavior:

- Working `/login` and `/signup` pages backed by NextAuth credentials.
- Protected `/dashboard` page with organization creation, organization list, and project list.
- Protected `/organizations/:orgId` page with project creation and project list.
- Protected `/projects/:projectId` page with issue creation, Kanban board, issue detail panel, comments, and activity feed.
- Loading, empty, and error states for the main frontend flows.
- Browser-verified login, dashboard loading, project board rendering, and comment creation.

### Day 4: Realtime and Analytics

1. Add Socket.io server.
2. Broadcast issue status updates.
3. Broadcast new comments.
4. Add project analytics API.
5. Visualize analytics with Recharts.

Analytics should include total issues, completed issues, overdue issues, issues by status, issues by priority, and member workload.

Implemented Day 4 behavior:

- Custom Next.js HTTP server with Socket.io support.
- Project room subscriptions with `project:join` and `project:leave`.
- Realtime broadcasts for issue creation, issue status/assignment updates, and comments.
- Internal authenticated realtime bridge used by API routes after database mutations.
- `GET /api/projects/:id/analytics` for project dashboard metrics.
- Recharts visualizations for issues by status, issues by priority, and member workload.
- Project page live status indicator and automatic refresh on realtime events.

## Team Collaboration Features

- Organization member management with role updates.
- Invitation flow with invite links, token validation, and acceptance on login/signup.
- Issue assignment to team members during issue creation and from the issue details panel.
- Issue labels for filtering and board context.
- Member workload analytics based on open assigned issues.

### Day 5: Polish, Testing, Deployment

1. Add clean loading, empty, and error states.
2. Add backend tests for RBAC, status updates, activity logs, and analytics.
3. Finalize README and screenshots.
4. Deploy to Vercel.
5. Use Supabase PostgreSQL for production.

Implemented Day 5 behavior:

- Vitest test setup for backend business logic.
- Tests for RBAC role hierarchy.
- Tests for issue status transition rules.
- Tests for activity log metadata builders.
- Tests for analytics aggregation shaping.
- GitHub Actions CI for lint, typecheck, tests, and build.
- Validation script for local pre-push checks.
- Deployment notes for Supabase PostgreSQL and realtime hosting.

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env`:

```bash
cp .env.example .env
```

For local PostgreSQL on macOS with Homebrew:

```bash
brew install postgresql@16
brew services start postgresql@16
/opt/homebrew/opt/postgresql@16/bin/createdb devboard
```

Update `DATABASE_URL` in `.env` if your local database user differs:

```bash
DATABASE_URL="postgresql://YOUR_MAC_USERNAME@localhost:5432/devboard?schema=public"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
```

Apply migrations:

```bash
npm run db:migrate
```

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## VS Code Workflow

Open the project:

```bash
cd "/Users/mewta/Documents/project management and engineering dashboard 2"
code .
```

In VS Code, open `Terminal -> New Terminal`, then run:

```bash
npm run dev
```

Use:

```text
http://localhost:3000
```

Do not use `127.0.0.1` for auth testing unless you also update `NEXTAUTH_URL`.

## API Smoke Test Flow

Create a user:

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo User","email":"demo@devboard.local","password":"password123"}'
```

Then sign in through `/login` once the frontend is built, or use Postman/Thunder Client with NextAuth cookies during backend testing.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Or run the full local check:

```bash
npm run validate
```

## Deployment Notes

Use Supabase PostgreSQL for production:

```bash
DATABASE_URL="your-supabase-connection-string"
NEXTAUTH_SECRET="your-production-secret"
NEXTAUTH_URL="https://your-production-domain"
REALTIME_SECRET="your-production-realtime-secret"
```

The app uses a custom Node server for Socket.io. For a full realtime production demo, deploy this repo to a Node server host such as Render, Railway, or Fly.io. If deploying the core Next.js app to Vercel, use a hosted realtime provider or separate Socket.io server for websocket features.
