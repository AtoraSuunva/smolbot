import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js'
import { formatUser, getGuild, SleetSlashSubcommand } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { getDefaultWarningConfig } from './config/edit.js'
import { formatUserWarningsToEmbed, getWarningsForUser } from './utils.js'

export const warningsAdd = new SleetSlashSubcommand(
  {
    name: 'add',
    description: 'Add a warning to a user',
    options: [
      {
        name: 'user',
        description: 'The user to warn',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: 'reason',
        description: 'The reason for the warning',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'mod_note',
        description:
          'A note for moderators, will not be shown to the user if they lookup warnings (default: none)',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'permanent',
        description: 'Whether the warning should be permanent (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'void',
        description: 'Whether the warning should be void (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: warningsAddRun,
  },
)

async function warningsAddRun(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const user = interaction.options.getUser('user', true)
  const reason = interaction.options.getString('reason', true)
  const modNote = interaction.options.getString('mod_note', false) ?? ''
  const permanent = interaction.options.getBoolean('permanent', false) ?? false
  const voidWarning = interaction.options.getBoolean('void', false) ?? false

  // So to create a new warning, we need to:
  // 0. Figure out the next warning ID to use in this guild
  // 1. Create a new warning that's warningID + 1

  // 0.
  const latestWarningIDInGuild = await prisma.warning.findFirst({
    select: {
      warningID: true,
    },
    where: {
      guildID: guild.id,
    },
    orderBy: {
      warningID: 'desc',
    },
  })

  const nextWarningID = (latestWarningIDInGuild?.warningID ?? 0) + 1

  // 1.
  await prisma.warning.create({
    data: {
      guildID: guild.id,
      warningID: nextWarningID,
      version: 1,
      user: user.tag,
      userID: user.id,
      reason,
      permanent,
      void: voidWarning,
      modNote,
      moderatorID: interaction.user.id,
      // This specifically needs to be null, it's how we tell which version of the warning is the latest
      validUntil: null,
    },
  })

  const allWarnings = await getWarningsForUser(guild.id, user.id)
  let config = await prisma.warningConfig.findUnique({
    where: {
      guildID: guild.id,
    },
  })

  const configMessage = !config
    ? `\n:information_source: No warning config exists, so I created a default config for you, see \`/warnings config edit\` to edit it.`
    : ''

  if (!config) {
    config = await prisma.warningConfig.create({
      data: {
        guildID: guild.id,
        ...getDefaultWarningConfig(),
      },
    })
  }

  const embed = formatUserWarningsToEmbed(user, allWarnings, config, {
    showModNote: true,
    showResponsibleMod: true,
    showVersion: true,
  })

  await interaction.reply({
    content: `Added warning to ${formatUser(user)}${configMessage}`,
    embeds: [embed],
  })
}
