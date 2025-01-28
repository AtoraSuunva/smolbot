-- CreateTable
CREATE TABLE "AutomodConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "prepend" TEXT
);

-- CreateTable
CREATE TABLE "AutomodRule" (
    "rule_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guild_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "delete" BOOLEAN NOT NULL,
    "parameters" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AutomaticDehoist" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL,
    "hoist_characters" TEXT NOT NULL,
    "dehoist_prepend" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);
