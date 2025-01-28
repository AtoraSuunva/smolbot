-- AlterTable
ALTER TABLE "MemberMutes" ADD COLUMN "executor" TEXT;

-- CreateTable
CREATE TABLE "ModMailForumConfig" (
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "open_tag" TEXT,
    "closed_tag" TEXT,

    PRIMARY KEY ("guild_id", "channel_id")
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ModMailConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "mod_reply_prefix" TEXT NOT NULL DEFAULT '!r',
    "mod_anon_reply_prefix" TEXT NOT NULL DEFAULT '!a',
    "mod_team_name" TEXT NOT NULL DEFAULT 'Mod Team'
);
INSERT INTO "new_ModMailConfig" ("guild_id", "mod_anon_reply_prefix", "mod_reply_prefix") SELECT "guild_id", "mod_anon_reply_prefix", "mod_reply_prefix" FROM "ModMailConfig";
DROP TABLE "ModMailConfig";
ALTER TABLE "new_ModMailConfig" RENAME TO "ModMailConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
