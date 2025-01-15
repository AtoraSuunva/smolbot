# Smol Bot & RobotOtter Privacy Policy

Last Updated & Effective as of: September 18, 2023

For Discord Bots: Smol Bot#6975 (205164225625194496) & RobotOtter#2318 (189078368522600449)

Smol Bot and RobotOtter are bots running the same codebase, but with Smol Bot as a "Staging" and private version. From hereafter, both bots will be referred to collectively as "The Bot" as both process the same data and are under the same Privacy Policy and TOS.

---

The Bot stores the following data, for the following reasons:

- Configuration data for the Welcome, Report, Voice Channel Logging, Mod Log, Warning, and Automod features as provided by guild admins
- User IDs (*not* usernames) are stored for the following features:
  - Which users had ever joined a guild for the "avoid welcoming rejoins" feature, IF:
    - the feature was enabled by guild admins, and the user joined the guild; or
    - guild admins added the user manually to the list.
  - A mapping of users to report ID & guild ID, though *no other report information is stored*. Report content is never persisted.
  - Which users have been banned from reporting from which guilds, by which moderator for which reasons.
  - Which user was warned and which moderator was responsible for the warning.
- Usernames are stored for warnings.

Interactions and options provided are logged for debugging purposes.

[Sentry](https://sentry.io) is used for error tracking. Data collected when an error occurs:

- `error`: The error message and stack trace
- `interaction`: The interaction + options used (ex. `/search [site<string>: example.com] [tags<string>: foo bar]`)
- `module`: The module that errored
- Local stack variables

Errors reported to Sentry are deleted after 90 days.

Config data for a guild is stored for 10 days after The Bot is removed from a guild, unless the bot is re-invited.

Data deleted manually or automatically (after 10 days of not being in the guild) is deleted permanently.

For a copy of your data, or to delete the data by request, you may contact the developer. Please note that you may be required to verify your identity and/or your permissions on a server before requests can be completed, to avoid unauthorized access or deletion of data.

[Discord's Privacy Policy](https://discord.com/privacy) also applies while using Discord

---

The Bot is run by atorasuunva (74768773940256768)

You may contact the developer of The Bot on the [support server](https://discord.gg/8K3uCfb), through Discord, or via email (atora@giraffeduck.com)

See also [The Bot's Terms of Service](./tos.md)
