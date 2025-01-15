-- CreateTable
CREATE TABLE "MuteConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "role_id" TEXT,
    "log_channel_id" TEXT
);

-- CreateTable
CREATE TABLE "MemberMutes" (
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "previous_roles" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("guild_id", "user_id")
);
