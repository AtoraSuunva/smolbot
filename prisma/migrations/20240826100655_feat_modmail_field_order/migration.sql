/*
  Warnings:

  - Added the required column `order` to the `ModMailTicketModalField` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ModMailTicketModalField" (
    "modmail_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "custom_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "style" INTEGER NOT NULL,
    "placeholder" TEXT,
    "required" BOOLEAN,
    "min_length" INTEGER,
    "max_length" INTEGER,

    PRIMARY KEY ("modmail_id", "guild_id", "custom_id")
);
INSERT INTO "new_ModMailTicketModalField" ("custom_id", "guild_id", "label", "max_length", "min_length", "modmail_id", "placeholder", "required", "style") SELECT "custom_id", "guild_id", "label", "max_length", "min_length", "modmail_id", "placeholder", "required", "style" FROM "ModMailTicketModalField";
DROP TABLE "ModMailTicketModalField";
ALTER TABLE "new_ModMailTicketModalField" RENAME TO "ModMailTicketModalField";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
