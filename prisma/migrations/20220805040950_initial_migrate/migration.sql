-- CreateTable
CREATE TABLE "WelcomeSettings" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "channel" TEXT,
    "rejoins" BOOLEAN NOT NULL DEFAULT false,
    "instant" BOOLEAN NOT NULL DEFAULT false,
    "ignore_roles" TEXT NOT NULL DEFAULT '',
    "react_with" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WelcomeJoins" (
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    PRIMARY KEY ("guild_id", "user_id")
);
