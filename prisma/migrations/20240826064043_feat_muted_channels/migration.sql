-- AlterTable
ALTER TABLE "MemberMutes" ADD COLUMN "mute_channel" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MuteConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "role_id" TEXT,
    "log_channel_id" TEXT,
    "separate_users" BOOLEAN NOT NULL DEFAULT false,
    "category_id" TEXT,
    "channel_topic" TEXT,
    "name_template" TEXT,
    "max_channels" INTEGER,
    "starter_message" TEXT
);
INSERT INTO "new_MuteConfig" ("guild_id", "log_channel_id", "role_id") SELECT "guild_id", "log_channel_id", "role_id" FROM "MuteConfig";
DROP TABLE "MuteConfig";
ALTER TABLE "new_MuteConfig" RENAME TO "MuteConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
