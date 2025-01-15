/*
  Warnings:

  - You are about to drop the column `guess_bot_delete` on the `DeletePoliceConfig` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DeletePoliceConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL,
    "threshold" INTEGER NOT NULL,
    "fuzziness" INTEGER NOT NULL,
    "footer_message" TEXT,
    "ignore_bots" BOOLEAN NOT NULL DEFAULT true,
    "ignore_mods" BOOLEAN NOT NULL DEFAULT true,
    "ignore_stickers" BOOLEAN NOT NULL DEFAULT false,
    "only_self_delete" BOOLEAN NOT NULL DEFAULT false,
    "bot_grace_time_ms" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_DeletePoliceConfig" ("enabled", "footer_message", "fuzziness", "guild_id", "ignore_bots", "ignore_mods", "only_self_delete", "threshold", "updated_at") SELECT "enabled", "footer_message", "fuzziness", "guild_id", "ignore_bots", "ignore_mods", "only_self_delete", "threshold", "updated_at" FROM "DeletePoliceConfig";
DROP TABLE "DeletePoliceConfig";
ALTER TABLE "new_DeletePoliceConfig" RENAME TO "DeletePoliceConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
