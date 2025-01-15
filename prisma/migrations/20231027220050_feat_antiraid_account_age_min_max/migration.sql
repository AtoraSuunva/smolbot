/*
  Warnings:

  - You are about to drop the column `account_age_limit` on the `AntiRaidConfig` table. All the data in the column will be lost.
  - You are about to alter the column `threshold` on the `AntiRaidConfig` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - Added the required column `account_age_limit_max` to the `AntiRaidConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_age_limit_min` to the `AntiRaidConfig` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AntiRaidConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL,
    "action" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "account_age_limit_min" INTEGER NOT NULL,
    "account_age_limit_max" INTEGER NOT NULL,
    "account_age_weight" INTEGER NOT NULL,
    "no_profile_picture_weight" INTEGER NOT NULL,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_AntiRaidConfig" ("account_age_weight", "action", "enabled", "guild_id", "no_profile_picture_weight", "threshold", "updated_at") SELECT "account_age_weight", "action", "enabled", "guild_id", "no_profile_picture_weight", "threshold", "updated_at" FROM "AntiRaidConfig";
DROP TABLE "AntiRaidConfig";
ALTER TABLE "new_AntiRaidConfig" RENAME TO "AntiRaidConfig";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
