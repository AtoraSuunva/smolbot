-- CreateTable
CREATE TABLE "AntiRaidConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL,
    "action" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "account_age_limit" INTEGER NOT NULL,
    "account_age_weight" INTEGER NOT NULL,
    "no_profile_picture_weight" INTEGER NOT NULL,
    "updated_at" DATETIME NOT NULL
);
