# ResourceHub Demo Recording Guide

Target length: about 4 minutes. This is a recording outline for the required assessment video; it is not a video recording.

## Before recording

- Start the app with `npm run dev` and confirm the database is connected.
- Prepare one administrator and one member account. The member should have changed the temporary password.
- Configure SMTP if you want to demonstrate email notifications. The main booking flow can be shown without SMTP.
- Have one active meeting room and one vehicle available, plus an open time slot for a booking.
- Keep the ER diagram open at [docs/er-diagram.md](er-diagram.md) for the architecture segment.
- Do not show real passwords, SMTP credentials, or private user data in the recording.

## Recording outline

### 0:00-0:30 | Problem and solution

Introduce the scheduling problem: shared resources, conflicting bookings, and unclear availability. Explain that ResourceHub provides member booking and administrator oversight.

### 0:30-1:10 | Member resource discovery

Sign in as a member. Browse the active resources and show category, location, and capacity filters. Select an available time and point out that availability is checked for that time window.

### 1:10-2:00 | Create a reservation

Create a reservation with a title and purpose. If practical, add a participant for a multi-seat resource. Show the resulting reservation status. Explain that overlapping reservations are rejected and that vehicle or out-of-hours bookings require approval.

### 2:00-2:50 | Administrator workflow

Sign in as an administrator. Show the pending reservation queue and approve or decline a request. Briefly show resource management and user management, including that resources can be deactivated without losing reservation history.

### 2:50-3:35 | Data model and reliability

Show the ER diagram. Explain the User-Reservation-Resource relationships and the optional ReservationParticipant records. Mention that the booking conflict check runs in a serializable database transaction and that pending bookings also occupy a time slot.

### 3:35-4:00 | Close

Summarize the practical outcomes: centralized availability, fewer scheduling conflicts, and a clear approval workflow. State the stack: Next.js App Router, TypeScript, PostgreSQL, and Prisma.

## Submission reminder

Record and review the final 3-5 minute video, then provide its accessible share link along with the repository and ER diagram link in the official assessment form. This repository contains the diagram and this recording outline; it does not contain a recorded video or a submitted form response.
