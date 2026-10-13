-- CreateTable
CREATE TABLE "ReservationParticipant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationParticipant_reservationId_idx" ON "ReservationParticipant"("reservationId");

-- AddForeignKey
ALTER TABLE "ReservationParticipant" ADD CONSTRAINT "ReservationParticipant_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
