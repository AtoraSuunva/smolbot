/*
  Warnings:

  - You are about to drop the `WarningHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Warnings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "WarningHistory";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Warnings";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Warning" (
    "guild_id" TEXT NOT NULL,
    "warning_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "user" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT false,
    "void" BOOLEAN NOT NULL DEFAULT false,
    "moderator_id" TEXT,
    "mod_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" DATETIME,

    PRIMARY KEY ("guild_id", "warning_id", "version")
);
