import { ApplicationCommandOptionType } from 'discord.js'
import {
  SleetSlashCommand,
  SleetSlashCommandGroup,
  SleetSlashSubcommand,
} from 'sleetcord'

// TODO for automod:
//  - Add a way to view the automod rules
//    - Include way to search
//    - Include pagination
//  - Add a way to remove automod rules
//  - Add a way to add automod rules
//    - Rules should have:
//      - Bot-set type
//      - User-customizable name
//      - User-customizable description (shown on trigger, optional)
//      - User-customizable arguments (varies per rule)
//    - Each rule should (somehow) define what it needs to generate the slash commands
//    - Each rule should be able to parse the DB row and create itself (on load)
//      - Could use the type as a discriminator to determine which rule to create
//    - Each rule should be able to serialize itself into a Prisma-compatible payload
//  - Add a way to edit automod rules?
//    - How? Good way to handle multiple types? Generate slash commands like add?

const automod_add_content_repeat_rule = new SleetSlashSubcommand(
  {
    name: 'content-repeat-rule',
    description: 'Filter out message content repeats',
    options: [
      {
        name: 'max-repeats',
        description: 'The maximum number of repeats allowed',
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 2,
        max_value: 100,
      },
    ],
  },
  {
    async run(interaction) {
      await interaction.reply('ok')
    },
  },
)

const automod_add = new SleetSlashCommandGroup({
  name: 'add',
  description: 'Add a new rule to automod',
  options: [automod_add_content_repeat_rule],
})

const automod_remove = new SleetSlashSubcommand(
  {
    name: 'remove',
    description: 'Remove a rule from automod',
    options: [
      {
        name: 'rule',
        description: 'The rule to remove',
        type: ApplicationCommandOptionType.String,
      },
    ],
  },
  {
    async run(interaction) {
      await interaction.reply('ok')
    },
  },
)

const automod_view = new SleetSlashSubcommand(
  {
    name: 'view',
    description: 'View the automod rules',
    options: [
      {
        name: 'name',
        description: 'Search rules by name',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'type',
        description: 'Search rules by type',
        type: ApplicationCommandOptionType.String,
      },
    ],
  },
  {
    async run(interaction) {
      await interaction.reply('ok')
    },
  },
)

export const automod = new SleetSlashCommand({
  name: 'automod',
  description: "Manage the bot's automod",
  options: [automod_add, automod_remove, automod_view],
})
