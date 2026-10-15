# Ruhunu ResourceHub

Ruhunu ResourceHub is a resource reservation system for an organization that shares meeting rooms, equipment, desks, vehicles, and other facilities.

People book a resource for a time window. The application blocks overlapping bookings, shows whether a resource is free, and sends vehicle bookings and out-of-hours bookings to an administrator for approval.

## Stack

- Next.js 16 (App Router) and React 19
- TypeScript
- PostgreSQL with Prisma ORM 7
- Session cookies signed with `jose`
- Nodemailer for account and booking email

## Prerequisites

- Node.js 20 or newer
- npm
- A local PostgreSQL database

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create the environment file and fill in the values from the table below:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Create the database named in `DATABASE_URL`, then apply the existing migrations and generate the Prisma client. The generated client is not committed.

```bash
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
```

4. Create the first administrator. The password must be 12–128 characters. This account is forced to change that password at first login.

Bash:

```bash
ADMIN_NAME="Admin" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="change-this-password" npx tsx scripts/create-admin.ts
```

PowerShell:

```powershell
$env:ADMIN_NAME="Admin"; $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="change-this-password"; npx tsx scripts/create-admin.ts
```

The script refuses to overwrite an email that already exists.

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visitors are sent to `/login`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Signs the session cookie. At least 32 characters |
| `APP_URL` | No | Base URL written into emails. Defaults to the request origin |
| `SMTP_HOST` | For email | SMTP server |
| `SMTP_PORT` | No | Defaults to `587`. Port `465` uses implicit TLS |
| `SMTP_USER` | For email | SMTP username |
| `SMTP_PASS` | For email | SMTP password |
| `SMTP_FROM` | For email | From address |
| `ADMIN_NAME` | For the script | First admin display name |
| `ADMIN_EMAIL` | For the script | First admin email |
| `ADMIN_PASSWORD` | For the script | Temporary admin password, 12–128 characters |

SMTP must be configured before an administrator can create more users from the dashboard. Without it, account creation, password-reset codes, and participant notices are not sent. Booking itself still works.

## Using the application

Sign in at `/login`.

- An **administrator** lands on `/admin`.
- A **member** lands on `/`.
- A first login, or any account flagged to change its password, goes to `/change-password` before either dashboard.

Forgot password on the login page emails a one-time code when SMTP is configured. Five failed logins lock the account for one hour. An administrator can unlock it.

### Member

- Browse active resources by category, location, and capacity.
- See which resources are free for the selected time.
- Book with a title, purpose, start, and end.
- Add participants when the resource holds more than one person. At least 70% of the seats must be filled, and the booker counts as one seat.
- Cancel an upcoming booking, or edit one that is still pending.
- Meeting rooms can be booked by a manager, team leader, scrum master, or administrator.

### Administrator

- Create, edit, and deactivate resources. Categories cover meeting rooms, shared equipment, desks and workspaces, company vehicles, and other facilities.
- Create users and choose a job position. The temporary password is emailed.
- Approve or decline pending reservations.
- Book a resource on behalf of another person.
- Unlock a locked account.

## Booking rules

- A booking lasts at least 15 minutes. Most resources are limited to 12 hours. Vehicles can be booked for up to 36 hours.
- Bookings can be made up to 90 days ahead, and the start time cannot be in the past.
- Confirmed and pending reservations both occupy the resource. A conflicting time returns an error and is not saved. The check runs inside a serializable transaction.
- Office hours are 08:00–20:00 in the booker's time zone. A booking outside those hours, or one that crosses midnight, stays pending until an administrator approves it.
- Every vehicle booking stays pending until an administrator approves it.
- Inactive resources cannot be booked.

## Data model

- **User** — name, email, password, role (`ADMIN` or `MEMBER`), job position, lockout state, and password-reset state.
- **Resource** — name, category, subcategory, location, capacity, description, facilities, images, and active status.
- **Reservation** — title, purpose, start, end, status (`CONFIRMED`, `PENDING`, or `CANCELLED`), and the user and resource it belongs to.
- **ReservationParticipant** — name and email of each additional person on a reservation.

One user has many reservations. One resource has many reservations. One reservation has many participants.

The ER diagram is available in [docs/er-diagram.md](docs/er-diagram.md). The short walkthrough in [docs/demo-script.md](docs/demo-script.md) can be used to record the required 3-5 minute demonstration.

## Project layout

```text
prisma/schema.prisma          Database models
prisma/migrations/            SQL migrations
prisma7.config.ts             Prisma CLI config
scripts/create-admin.ts       Creates the first administrator
src/app/page.tsx              Member dashboard page
src/app/dashboard-client.tsx  Member screen state
src/components/member/        Browse, booking, schedule, and reservation views
src/app/admin/page.tsx        Admin dashboard page
src/components/admin/         Users, resources, reservations, and reports
src/app/login/page.tsx        Sign in and password reset
src/app/api/                  Auth, users, resources, and reservations
src/lib/                      Booking rules, auth, and mail
```

## Scripts

```bash
npm run dev      # local development
npm run build    # production build
npm run start    # run the production build
npm run lint     # ESLint
```
