-- CreateTable
CREATE TABLE "ReportConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "channel_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);
