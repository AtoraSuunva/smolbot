-- CreateTable
CREATE TABLE "ModLogConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "channel_id" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "member_add" BOOLEAN NOT NULL,
    "member_add_new" BOOLEAN NOT NULL,
    "member_add_invite" BOOLEAN NOT NULL,
    "member_welcome" BOOLEAN NOT NULL,
    "member_remove" BOOLEAN NOT NULL,
    "member_remove_roles" BOOLEAN NOT NULL,
    "member_ban" BOOLEAN NOT NULL,
    "member_unban" BOOLEAN NOT NULL,
    "member_update" BOOLEAN NOT NULL,
    "message_delete" BOOLEAN NOT NULL,
    "message_delete_bulk" BOOLEAN NOT NULL,
    "channel_create" BOOLEAN NOT NULL,
    "channel_delete" BOOLEAN NOT NULL,
    "reaction_actions" BOOLEAN NOT NULL,
    "automod_action" BOOLEAN NOT NULL
);
