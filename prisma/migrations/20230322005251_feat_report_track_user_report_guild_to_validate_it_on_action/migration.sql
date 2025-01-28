/*
  Warnings:

  - Added the required column `guild_id` to the `UserReport` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserReport" (
    "report_id" TEXT NOT NULL PRIMARY KEY,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_UserReport" ("created_at", "report_id", "user_id") SELECT "created_at", "report_id", "user_id" FROM "UserReport";
DROP TABLE "UserReport";
ALTER TABLE "new_UserReport" RENAME TO "UserReport";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
