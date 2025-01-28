-- CreateTable
CREATE TABLE "ActionLogConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "log_bans" BOOLEAN NOT NULL,
    "log_unbans" BOOLEAN NOT NULL,
    "log_kicks" BOOLEAN NOT NULL,
    "log_timeouts" BOOLEAN NOT NULL,
    "log_timeout_removals" BOOLEAN NOT NULL,
    "log_channel_id" TEXT,
    "archive_enabled" BOOLEAN NOT NULL DEFAULT false,
    "archive_channel" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActionLogDirtyTracker" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "last_set_dirty" DATETIME NOT NULL,
    "is_dirty" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "guild_id" TEXT NOT NULL,
    "action_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT,
    "reason" TEXT,
    "reason_by_id" TEXT,
    "moderator_id" TEXT,
    "channel_id" TEXT NOT NULL,
    "message_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" DATETIME,

    PRIMARY KEY ("guild_id", "action_id", "version")
);
