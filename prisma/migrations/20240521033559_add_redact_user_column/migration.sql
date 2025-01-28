-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActionLog" (
    "guild_id" TEXT NOT NULL,
    "action_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT,
    "redact_user" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "reason_by_id" TEXT,
    "moderator_id" TEXT,
    "channel_id" TEXT NOT NULL,
    "message_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" DATETIME,

    PRIMARY KEY ("guild_id", "action_id", "version")
);
INSERT INTO "new_ActionLog" ("action", "action_id", "channel_id", "created_at", "guild_id", "message_id", "moderator_id", "reason", "reason_by_id", "user_id", "valid_until", "version") SELECT "action", "action_id", "channel_id", "created_at", "guild_id", "message_id", "moderator_id", "reason", "reason_by_id", "user_id", "valid_until", "version" FROM "ActionLog";
DROP TABLE "ActionLog";
ALTER TABLE "new_ActionLog" RENAME TO "ActionLog";
PRAGMA foreign_key_check("ActionLog");
PRAGMA foreign_keys=ON;
