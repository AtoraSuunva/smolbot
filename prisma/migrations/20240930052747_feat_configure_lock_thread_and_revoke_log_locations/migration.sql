-- CreateTable
CREATE TABLE "RevokeConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelID" TEXT
);

-- CreateTable
CREATE TABLE "LockThreadConfig" (
    "source_channel_id" TEXT NOT NULL PRIMARY KEY,
    "log_channel_id" TEXT
);
