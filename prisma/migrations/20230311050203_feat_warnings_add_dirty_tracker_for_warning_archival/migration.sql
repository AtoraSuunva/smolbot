-- CreateTable
CREATE TABLE "WarningArchive" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "last_set_dirty" DATETIME NOT NULL,
    "is_dirty" BOOLEAN NOT NULL
);
