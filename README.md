# DevBoard

DevBoard is a full-stack project management and engineering dashboard built for small software teams. It combines issue tracking, sprint planning, team collaboration, realtime updates, workload analytics, automated reports, and public roadmaps in one application.

The project is designed as a practical alternative to heavyweight tools for teams that need clear ownership, useful engineering metrics, and fast day-to-day workflows.

## Core Features

### Authentication and Access Control

- Email and password authentication with NextAuth.js.
- Protected dashboard, organization, project, and issue routes.
- Organization-level role-based access control.
- Four membership roles: `OWNER`, `ADMIN`, `DEVELOPER`, and `VIEWER`.
- Server-side authorization checks for every protected API operation.
- Role-aware controls for organization management, project creation, issue updates, assignments, comments, reports, and sprint administration.

### Organizations and Team Management

- Create and manage multiple organizations.
- Invite users through secure invitation links.
- Accept invitations during signup or login.
- View organization members and their current roles.
- Update member roles based on the current user's permissions.
- Keep projects, memberships, invitations, and reports isolated by organization.

### Projects and Engineering Workspaces

- Create projects with a name, key, and description.
- View all accessible projects from the dashboard.
- Open a dedicated workspace for each project.
- Track issue totals and project activity.
- Maintain organization membership checks across every project query.

### Issue Tracking and Kanban Board

- Create issues with a title, description, status, priority, due date, estimate, labels, and assignee.
- Organize work into `TODO`, `IN_PROGRESS`, `IN_REVIEW`, and `DONE` columns.
- Move issues through validated status transitions.
- Prevent blocked issues from moving to `DONE`.
- Assign and reassign issues to organization members.
- Filter issues by status, assignee, label, blocked state, and search query.
- Display overdue work, estimates, comment totals, labels, and blockers directly on the project board.

### Comments, Activity, and Collaboration

- Add comments to issues.
- Record meaningful project actions in an activity feed.
- Track issue creation, status changes, assignments, comments, dependencies, sprint changes, and weekly report generation.
- Show issue and project history with the user responsible for each action.
- Keep activity records scoped to the correct project and issue.

### Issue Dependencies and Blockers

- Mark one issue as blocked by another issue.
- View both incoming blockers and issues that depend on the selected issue.
- Prevent duplicate dependency relationships.
- Detect and reject circular dependency chains.
- Block the `DONE` transition until every required dependency is completed.
- Add and remove dependencies with realtime updates.

### Realtime Collaboration

- Socket.io project rooms keep updates scoped to the active project.
- Live events are sent for issue creation, status changes, assignments, comments, dependency changes, reports, and sprint updates.
- Project pages refresh relevant data when another team member makes a change.
- A live connection indicator shows the current realtime state.
- API routes can publish events through an authenticated internal realtime bridge.

### Global Command Palette

- Open the command palette from authenticated pages with `Command + K` or `Ctrl + K`.
- Navigate to projects, issues, organization settings, and other common destinations.
- Search projects, issues, and members through an authorization-aware search endpoint.
- Run contextual issue commands such as changing status, assigning a member, and adding labels.
- Use nested command pages for multi-step actions.
- Register commands through a typed command registry instead of hardcoding actions into the palette UI.

### Project Analytics

- View total, completed, and overdue issue counts.
- Compare issue distribution by status and priority.
- Visualize project metrics with Recharts.
- Keep analytics queries restricted to users with project access.

### Workload Analytics and Overload Detection

- Calculate workload for every project member.
- Measure open issues, completed issues, overdue work, blocked work, urgent work, high-priority work, and estimated hours.
- Produce a workload score for each member.
- Classify members as `UNDERLOADED`, `BALANCED`, or `OVERLOADED`.
- Filter workload views to all work, open work, or overdue work.
- Show team-level totals for open, blocked, overdue, and overloaded work.

### Weekly Team Reports

- Generate weekly reports for a project.
- Summarize created issues, completed issues, review activity, comments, overdue work, blockers, workload, priorities, statuses, and top contributors.
- Store generated reports in PostgreSQL.
- Run report generation inline when Redis is unavailable.
- Use BullMQ when Redis is configured.
- Publish realtime events after a report is generated.

### Public Read-Only Roadmaps

- Mark a project as public from the authenticated project workspace.
- Generate a stable, non-sequential public URL.
- Disable and re-enable the public roadmap without changing its existing link.
- Display a public Kanban-style roadmap at `/p/[slug]`.
- Allow visitors to view project progress without creating an account.
- Return only an explicit allow-list of public fields.
- Never expose comments, member identities, emails, activity logs, organization data, or internal notes.
- Protect the unauthenticated endpoint with caching and rate limiting.

### Read-Only Demo Mode

- Enter a populated workspace through the `Try Demo` button without completing a signup form.
- Use a deterministic demo organization containing three projects, 30 issues, comments, dependencies, reports, sprint history, and analytics data.
- Show a persistent banner explaining that the demo is read-only.
- Block every demo mutation on the server, including direct API requests.
- Return clear user-facing messages when a demo user attempts to change data.
- Reset only the fixed demo organization through a scheduled BullMQ job every six hours when Redis is available.
- Recreate the same demo dataset safely with:

```bash
npm run demo:seed
```

### Sprint Planning

- Create planned sprints with start and end dates.
- Start one active sprint per project.
- Complete active sprints through validated lifecycle transitions.
- Assign issues to a planned or active sprint.
- Move issues back to the backlog.
- Record issue additions and removals in the activity log.
- Publish sprint scope and lifecycle changes through realtime events.

### Sprint Burndown

- Store one daily `SprintSnapshot` for each sprint.
- Measure work by issue count.
- Track total scope, remaining work, and completed work.
- Rebuild each snapshot by replaying sprint membership and issue status events from `ActivityLog`.
- Correctly represent reopened issues and scope changes during a sprint.
- Upsert snapshots by sprint and UTC date so scheduled jobs are safe to rerun.
- Compare the actual remaining work with a calculated ideal line.
- Preserve visible gaps when a daily snapshot is missing.
- Generate a snapshot manually for testing or newly seeded data.
- Automatically create the final snapshot when a sprint is completed.

### Velocity Analytics

- Display completed work across recent completed sprints.
- Use each sprint's final snapshot as the source of completed and total scope values.
- Calculate average project velocity.
- Show completed work with a Recharts bar chart and average reference line.

## Technology Stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Recharts

### Backend

- Next.js Route Handlers
- Prisma ORM
- PostgreSQL
- NextAuth.js
- Zod validation
- Socket.io
- BullMQ
- Redis

### Testing and Quality

- Vitest
- ESLint
- TypeScript type checking
- Prisma migrations
- Production build validation

## Architecture

DevBoard uses the Next.js App Router for both the user interface and HTTP API. Prisma provides typed database access to PostgreSQL. NextAuth.js manages authenticated sessions, while shared authorization helpers enforce organization and project access inside API routes.

The custom Node server starts Next.js and Socket.io together. Connected clients join project-specific rooms, and successful mutations publish events only to the affected project.

BullMQ handles background work when `REDIS_URL` is configured. The current worker supports weekly report jobs, scheduled demo resets, and daily sprint snapshots. Operations that do not require scheduling can fall back to inline execution when Redis is unavailable.

Sprint analytics use `ActivityLog` as the historical source of truth. Daily snapshots are derived by replaying issue status changes and sprint scope events instead of relying only on the issue's current state.

## Main Data Models

- `User`: authentication identity and demo-account state.
- `Organization`: top-level workspace containing members and projects.
- `Membership`: connects users to organizations with an assigned role.
- `Invitation`: secure organization invitation with status and expiration.
- `Project`: engineering workspace containing issues, sprints, reports, and activity.
- `Issue`: trackable work item with status, priority, labels, estimate, ownership, and sprint assignment.
- `Comment`: issue discussion written by an authenticated user.
- `IssueDependency`: directed blocker relationship between two issues.
- `ActivityLog`: historical record used by activity feeds, reports, and sprint replay.
- `Sprint`: planned, active, or completed delivery period.
- `SprintSnapshot`: daily scope and completion state for burndown and velocity.
- `WeeklyReport`: stored project summary for a specific week.

## Project Structure

```text
prisma/
  migrations/             Database migrations
  schema.prisma           Prisma models, enums, relations, and indexes
  seed-demo.ts            Deterministic demo workspace seed

src/
  app/                    App Router pages and API routes
  commands/               Typed command palette definitions
  components/             Dashboard, project, layout, and UI components
  lib/                    Auth, Prisma, analytics, queues, realtime, and business logic
  types/                  Shared TypeScript declarations
  workers/                BullMQ worker entry point

tests/
  lib/                    Unit tests for core business rules

server.mjs                Custom Next.js and Socket.io server
```

## Local Setup

### Requirements

- Node.js
- npm
- PostgreSQL
- Redis is optional but required for scheduled BullMQ jobs

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file:

```env
DATABASE_URL="postgresql://YOUR_DATABASE_USER@localhost:5432/devboard?schema=public"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
REALTIME_SECRET="replace-with-a-second-long-random-secret"
REDIS_URL="redis://localhost:6379"
```

`REDIS_URL` can be omitted when testing the core application without scheduled background jobs.

### Create a Local PostgreSQL Database on macOS

```bash
brew install postgresql@16
brew services start postgresql@16
/opt/homebrew/opt/postgresql@16/bin/createdb devboard
```

### Apply Database Migrations

```bash
npm run db:migrate
```

### Seed the Demo Workspace

```bash
npm run demo:seed
```

### Start the Application

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Use the same hostname configured in `NEXTAUTH_URL` when testing authentication.

## Background Workers

Start the BullMQ worker:

```bash
npm run worker:reports
```

When Redis is configured, this process handles:

- Weekly project report generation
- Demo workspace resets every six hours
- Active sprint snapshots every day at `00:05 UTC`

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
npm run validate
npm run db:generate
npm run db:migrate
npm run db:studio
npm run demo:seed
npm run worker:reports
```

## Validation

Run the complete validation pipeline:

```bash
npm run validate
```

Or run each check separately:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deployment

Use a managed PostgreSQL provider such as Supabase for production and configure:

```env
DATABASE_URL="your-production-postgresql-connection-string"
NEXTAUTH_SECRET="your-production-auth-secret"
NEXTAUTH_URL="https://your-production-domain"
REALTIME_SECRET="your-production-realtime-secret"
REDIS_URL="your-production-redis-connection-string"
```

The application uses a custom Node server for Socket.io. Deploy the complete realtime application to a Node-compatible host such as Railway, Render, or Fly.io.

If the Next.js application is deployed to Vercel, run Socket.io and BullMQ workers as separate services or replace Socket.io with a hosted realtime provider. Scheduled jobs also require a persistent worker process and Redis.

## Security Notes

- Protected APIs verify the authenticated user on the server.
- Organization and project membership checks are applied before returning private data.
- Mutating routes enforce role requirements and demo-account restrictions.
- Public roadmap data is fetched through a separate query path with explicit Prisma field selection.
- Private comments, user emails, activity records, and organization details are never included in public roadmap responses.
- Demo reset operations are always restricted to the fixed demo organization ID.
- Issue dependency creation rejects circular relationships.
- Sprint snapshot generation uses idempotent database upserts.
