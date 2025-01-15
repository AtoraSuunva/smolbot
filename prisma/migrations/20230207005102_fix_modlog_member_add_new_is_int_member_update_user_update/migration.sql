/*
  Warnings:

  - You are about to drop the column `member_update` on the `ModLogConfig` table. All the data in the column will be lost.
  - You are about to alter the column `member_add_new` on the `ModLogConfig` table. The data in that column could be lost. The data in that column will be cast from `Boolean` to `Int`.
  - Added the required column `user_update` to the `ModLogConfig` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ModLogConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "channel_id" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "member_add" BOOLEAN NOT NULL,
    "member_add_new" INTEGER NOT NULL,
    "member_add_invite" BOOLEAN NOT NULL,
    "member_welcome" BOOLEAN NOT NULL,
    "member_remove" BOOLEAN NOT NULL,
    "member_remove_roles" BOOLEAN NOT NULL,
    "member_ban" BOOLEAN NOT NULL,
    "member_unban" BOOLEAN NOT NULL,
    "user_update" BOOLEAN NOT NULL,
    "message_delete" BOOLEAN NOT NULL,
    "message_delete_bulk" BOOLEAN NOT NULL,
    "channel_create" BOOLEAN NOT NULL,
    "channel_delete" BOOLEAN NOT NULL,
    "reaction_actions" BOOLEAN NOT NULL,
    "automod_action" BOOLEAN NOT NULL
);
INSERT INTO "new_ModLogConfig" ("automod_action", "channel_create", "channel_delete", "channel_id", "enabled", "guild_id", "member_add", "member_add_invite", "member_add_new", "member_ban", "member_remove", "member_remove_roles", "member_unban", "member_welcome", "message_delete", "message_delete_bulk", "reaction_actions", "updated_at") SELECT "automod_action", "channel_create", "channel_delete", "channel_id", "enabled", "guild_id", "member_add", "member_add_invite", "member_add_new", "member_ban", "member_remove", "member_remove_roles", "member_unban", "member_welcome", "message_delete", "message_delete_bulk", "reaction_actions", "updated_at" FROM "ModLogConfig";
DROP TABLE "ModLogConfig";
ALTER TABLE "new_ModLogConfig" RENAME TO "ModLogConfig";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
