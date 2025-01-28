import type { RevokeConfig } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  Constants,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { getOptionCount } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { formatConfig } from '../../util/format.js'

export const revoke_config = new SleetSlashSubcommand(
  {
    name: 'config',
    description: 'Config auto-revoking invites from banned users',
    options: [
      {
        name: 'enabled',
        description: 'Enable auto-revoking invites from banned users',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'channel',
        description: 'Channel to log revoked invites in',
        type: ApplicationCommandOptionType.Channel,
        channel_types: Constants.GuildTextBasedChannelTypes,
      },
    ],
  },
  {
    run: runRevokeConfig,
  },
)

async function runRevokeConfig(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const oldConfig = await prisma.revokeConfig.findFirst({
    where: {
      guildID: guild.id,
    },
  })

  if (getOptionCount(interaction) === 0) {
    // No options specified, show the current config
    if (!oldConfig) {
      return interaction.reply({
        content:
          "You don't have an existing revoke config, use `/revoke config` with options to create one.",
      })
    }

    return interaction.reply({
      content: `Current config:\n${formatConfig({
        config: oldConfig,
        guild,
      })}`,
    })
  }

  const { options } = interaction
  const enabled = options.getBoolean('enabled')
  const channel = options.getChannel('channel')

  const mergedConfig: Omit<RevokeConfig, 'updatedAt'> = {
    guildID: guild.id,
    enabled: enabled ?? oldConfig?.enabled ?? false,
    channelID: channel?.id ?? oldConfig?.channelID ?? null,
  }

  await prisma.revokeConfig.upsert({
    where: {
      guildID: guild.id,
    },
    update: mergedConfig,
    create: mergedConfig,
  })

  return interaction.reply({
    content: `Revoke Config:\n${formatConfig({
      config: mergedConfig,
      oldConfig,
      guild,
    })}`,
  })
}
