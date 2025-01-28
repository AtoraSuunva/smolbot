-- CreateTable
CREATE TABLE "WarningConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "expires_after" INTEGER NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Warnings" (
    "guild_id" TEXT NOT NULL,
    "warning_id" INTEGER NOT NULL,
    "user" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,

    PRIMARY KEY ("guild_id", "warning_id"),
    CONSTRAINT "Warnings_warning_id_version_fkey" FOREIGN KEY ("warning_id", "version") REFERENCES "WarningHistory" ("warning_id", "version") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WarningHistory" (
    "warning_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT false,
    "void" BOOLEAN NOT NULL DEFAULT false,
    "moderator_id" TEXT,
    "mod_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("warning_id", "version"),
    CONSTRAINT "WarningHistory_warning_id_fkey" FOREIGN KEY ("warning_id") REFERENCES "Warnings" ("warning_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Warnings_warning_id_key" ON "Warnings"("warning_id");
