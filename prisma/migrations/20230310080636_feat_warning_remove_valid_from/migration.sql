/*
  Warnings:

  - You are about to drop the column `valid_from` on the `Warning` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Warning" (
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
INSERT INTO "new_Warning" ("created_at", "guild_id", "mod_note", "moderator_id", "permanent", "reason", "user", "user_id", "valid_until", "version", "void", "warning_id") SELECT "created_at", "guild_id", "mod_note", "moderator_id", "permanent", "reason", "user", "user_id", "valid_until", "version", "void", "warning_id" FROM "Warning";
DROP TABLE "Warning";
ALTER TABLE "new_Warning" RENAME TO "Warning";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
