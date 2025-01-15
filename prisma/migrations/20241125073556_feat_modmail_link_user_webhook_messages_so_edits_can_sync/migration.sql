-- CreateTable
CREATE TABLE "ModMailTicketMessage" (
    "user_message_id" TEXT NOT NULL PRIMARY KEY,
    "webhook_message_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
