/*
  Warnings:

  - You are about to alter the column `account_age_limit_max` on the `AntiRaidConfig` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `account_age_limit_min` on the `AntiRaidConfig` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `account_age_weight` on the `AntiRaidConfig` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `no_profile_picture_weight` on the `AntiRaidConfig` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AntiRaidConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL,
    "action" TEXT NOT NULL,
    "timeout_duration" INTEGER NOT NULL,
    "threshold" REAL NOT NULL,
    "account_age_limit_min" REAL NOT NULL,
    "account_age_limit_max" REAL NOT NULL,
    "account_age_weight" REAL NOT NULL,
    "no_profile_picture_weight" REAL NOT NULL,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_AntiRaidConfig" ("account_age_limit_max", "account_age_limit_min", "account_age_weight", "action", "enabled", "guild_id", "no_profile_picture_weight", "threshold", "timeout_duration", "updated_at") SELECT "account_age_limit_max", "account_age_limit_min", "account_age_weight", "action", "enabled", "guild_id", "no_profile_picture_weight", "threshold", "timeout_duration", "updated_at" FROM "AntiRaidConfig";
DROP TABLE "AntiRaidConfig";
ALTER TABLE "new_AntiRaidConfig" RENAME TO "AntiRaidConfig";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
