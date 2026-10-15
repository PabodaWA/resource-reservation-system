# ResourceHub ER Diagram

This diagram reflects the current Prisma schema in `prisma/schema.prisma`.

```mermaid
erDiagram
    USER ||--o{ RESERVATION : books
    RESOURCE ||--o{ RESERVATION : is_reserved_for
    RESERVATION ||--o{ RESERVATION_PARTICIPANT : includes

    USER {
        string id PK
        string name
        string email UK
        string passwordHash "nullable"
        enum role "ADMIN or MEMBER"
        enum jobPosition
        boolean isActive
        boolean mustChangePassword
        int failedLoginAttempts
        datetime lockedUntil "nullable"
        string passwordResetOtpHash "nullable"
        datetime passwordResetOtpExpiry "nullable"
        int passwordResetAttempts
        datetime createdAt
        datetime updatedAt
    }

    RESOURCE {
        string id PK
        string name
        string category
        string subcategory
        string location
        int capacity
        string description "nullable"
        string facilities "nullable"
        string_array images
        enum status "ACTIVE or INACTIVE"
        datetime createdAt
        datetime updatedAt
    }

    RESERVATION {
        string id PK
        string title
        string purpose "nullable"
        datetime startTime
        datetime endTime
        enum status "CONFIRMED PENDING or CANCELLED"
        string userId FK
        string resourceId FK
        datetime createdAt
        datetime updatedAt
    }

    RESERVATION_PARTICIPANT {
        string id PK
        string name
        string email
        string reservationId FK
        datetime createdAt
    }
```

## Relationship and booking notes

- A user can create many reservations. Every reservation belongs to exactly one user.
- A resource can have many reservations. Every reservation is for exactly one resource.
- A reservation can have zero or more additional participants. The booker is represented by the `userId` relationship, not duplicated as a participant.
- Deleting a reservation cascades to its participants. Users and resources are restricted from deletion while reservations still reference them; resource removal in the application deactivates it first and only permits deletion after upcoming reservations finish.
- Both pending and confirmed reservations block overlapping time slots. Cancelled reservations do not.

The schema also indexes reservation lookups by resource and time range, and participant lookups by reservation.
