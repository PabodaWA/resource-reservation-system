-- Existing administrator accounts keep the Admin job position.
UPDATE "User" SET "jobPosition" = 'ADMIN' WHERE "role" = 'ADMIN';
