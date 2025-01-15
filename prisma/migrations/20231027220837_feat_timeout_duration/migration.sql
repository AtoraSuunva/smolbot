/*
  Warnings:

  - Added the required column `timeout_duration` to the `AntiRaidConfig` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AntiRaidConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL,
    "action" TEXT NOT NULL,
    "timeout_duration" INTEGER NOT NULL,
    "threshold" REAL NOT NULL,
    "account_age_limit_min" INTEGER NOT NULL,
    "account_age_limit_max" INTEGER NOT NULL,
    "account_age_weight" INTEGER NOT NULL,
    "no_profile_picture_weight" INTEGER NOT NULL,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_AntiRaidConfig" ("account_age_limit_max", "account_age_limit_min", "account_age_weight", "action", "enabled", "guild_id", "no_profile_picture_weight", "threshold", "updated_at") SELECT "account_age_limit_max", "account_age_limit_min", "account_age_weight", "action", "enabled", "guild_id", "no_profile_picture_weight", "threshold", "updated_at" FROM "AntiRaidConfig";
DROP TABLE "AntiRaidConfig";
ALTER TABLE "new_AntiRaidConfig" RENAME TO "AntiRaidConfig";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
