-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WarningConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "expires_after" INTEGER NOT NULL,
    "archive_enabled" BOOLEAN NOT NULL DEFAULT false,
    "archive_channel" TEXT,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_WarningConfig" ("archive_channel", "expires_after", "guild_id", "updated_at") SELECT "archive_channel", "expires_after", "guild_id", "updated_at" FROM "WarningConfig";
DROP TABLE "WarningConfig";
ALTER TABLE "new_WarningConfig" RENAME TO "WarningConfig";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
