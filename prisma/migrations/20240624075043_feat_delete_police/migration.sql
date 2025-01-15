-- CreateTable
CREATE TABLE "DeletePoliceConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL,
    "threshold" INTEGER NOT NULL,
    "fuzziness" INTEGER NOT NULL,
    "footer_message" TEXT,
    "updated_at" DATETIME NOT NULL
);
