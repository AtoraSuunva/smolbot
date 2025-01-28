-- CreateTable
CREATE TABLE "ModMailConfig" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "mod_reply_prefix" TEXT NOT NULL DEFAULT '!r',
    "mod_anon_reply_prefix" TEXT NOT NULL DEFAULT '!a'
);

-- CreateTable
CREATE TABLE "ModMailTicketConfig" (
    "modmail_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "max_open_tickets" INTEGER,
    "ratelimit" INTEGER,

    PRIMARY KEY ("modmail_id", "guild_id")
);

-- CreateTable
CREATE TABLE "ModMailTicket" (
    "ticket_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modmail_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_channel_id" TEXT NOT NULL,
    "user_thread_id" TEXT NOT NULL,
    "mod_channel_id" TEXT NOT NULL,
    "mod_thread_id" TEXT NOT NULL,
    "link_deleted" BOOLEAN NOT NULL DEFAULT false,
    "open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ModMailTicketModalField" (
    "modmail_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "custom_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "style" INTEGER NOT NULL,
    "placeholder" TEXT,
    "required" BOOLEAN,
    "min_length" INTEGER,
    "max_length" INTEGER,

    PRIMARY KEY ("modmail_id", "guild_id", "custom_id")
);
