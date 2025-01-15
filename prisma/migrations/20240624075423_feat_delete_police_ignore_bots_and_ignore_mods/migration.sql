/*
  Warnings:

  - Added the required column `ignore_bots` to the `DeletePoliceConfig` table without a default value. This is not possible if the table is not empty.

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
    "ignore_bots" BOOLEAN NOT NULL,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_DeletePoliceConfig" ("enabled", "footer_message", "fuzziness", "guild_id", "threshold", "updated_at") SELECT "enabled", "footer_message", "fuzziness", "guild_id", "threshold", "updated_at" FROM "DeletePoliceConfig";
DROP TABLE "DeletePoliceConfig";
ALTER TABLE "new_DeletePoliceConfig" RENAME TO "DeletePoliceConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
