/*
  Warnings:

  - You are about to drop the `WarningArchive` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "WarningArchive";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "WarningDirtyTracker" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "last_set_dirty" DATETIME NOT NULL,
    "is_dirty" BOOLEAN NOT NULL
);
