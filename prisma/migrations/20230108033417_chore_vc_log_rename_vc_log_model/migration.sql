/*
  Warnings:

  - You are about to drop the `VCLogConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "VCLogConfig";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "VoiceLogConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "channel_id" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);
