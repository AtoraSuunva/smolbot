import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  InteractionContextType,
} from 'discord.js'
import { SleetSlashCommand, getGuild } from 'sleetcord'
import { getOptionCount } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { formatConfig } from '../../util/format.js'

export const manage_quote = new SleetSlashCommand(
  {
    name: 'manage_quote',
    description: 'Manage the quoting system',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    default_member_permissions: ['ManageGuild'],
    options: [
      {
        name: 'enabled',
        description: 'Enable auto-quoting message links (default: True)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runManageQuote,
  },
)

async function runManageQuote(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const oldConfig = await prisma.quoteConfig.findUnique({
    where: {
      guildID: guild.id,
    },
  })

  if (getOptionCount(interaction) === 0) {
    // No options specified, show the current settings
    if (!oldConfig) {
      return interaction.editReply({
        content:
          "You don't have an existing quote config, use `/manage_quote` with options to create one.",
      })
    }

    return interaction.reply({
      content: `Current config:\n${formatConfig({
        config: oldConfig,
        guild,
      })}`,
      allowedMentions: { parse: [] },
    })
  }

  const enabled = interaction.options.getBoolean('enabled')

  const newConfig = await prisma.quoteConfig.upsert({
    where: {
      guildID: guild.id,
    },
    update: {
      enabled: enabled ?? oldConfig?.enabled ?? true,
    },
    create: {
      guildID: guild.id,
      enabled: enabled ?? true,
    },
  })

  return interaction.reply({
    content: `Quote config updated.\n${formatConfig({
      config: newConfig,
      oldConfig,
      guild,
    })}`,
    allowedMentions: { parse: [] },
  })
}
