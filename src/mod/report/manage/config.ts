import type { ReportConfig } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  Constants,
  type Guild,
  type GuildTextBasedChannel,
  type User,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { getOptionCount } from 'sleetcord-common'
import { prisma } from '../../../util/db.js'
import { formatConfig } from '../../../util/format.js'
import { handleReportButtonInteraction } from '../utils.js'

export const report_manage_config = new SleetSlashSubcommand(
  {
    name: 'config',
    description: 'View or edit the report system config',
    options: [
      {
        name: 'enabled',
        description: 'Enable or disable the report system',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'channel',
        description: 'The channel to send reports to',
        type: ApplicationCommandOptionType.Channel,
        channel_types: Constants.GuildTextBasedChannelTypes,
      },
      {
        name: 'message',
        description:
          'The message to send when a report is made. Use "none" for no message. (default: "Report Received")',
        type: ApplicationCommandOptionType.String,
      },
    ],
  },
  {
    run: runReportManage,
    interactionCreate: handleReportButtonInteraction,
  },
)

async function runReportManage(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const oldConfig = await prisma.reportConfig.findUnique({
    where: {
      guildID: guild.id,
    },
  })

  // No options specified, show the current config
  if (getOptionCount(interaction) === 0) {
    if (!oldConfig) {
      return interaction.reply({
        content:
          "You don't have an existing report config, use `/report_manage config` with options to create one.",
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
  const channel = interaction.options.getChannel('channel')
  const messageArg = interaction.options.getString('message')
  const message = messageArg?.toLowerCase() === 'none' ? '' : messageArg

  const newConfig = await prisma.reportConfig.upsert({
    where: {
      guildID: guild.id,
    },
    update: {
      enabled: enabled ?? oldConfig?.enabled ?? true,
      channelID: channel?.id ?? oldConfig?.channelID ?? null,
      message: message ?? oldConfig?.message ?? '',
    },
    create: {
      guildID: guild.id,
      enabled: enabled ?? true,
      channelID: channel?.id ?? null,
      message: message ?? '',
    },
  })

  const warnings: string[] = []

  if (!newConfig.enabled) {
    warnings.push('The report system is currently disabled.')
  }

  if (!newConfig.channelID) {
    warnings.push(
      'The report channel has not been set. You will not receive any reports.',
    )
  }

  const warningsMessage = warnings.length > 0 ? `\n${warnings.join('\n')}` : ''

  return interaction.reply({
    content: `Report config updated.\n${formatConfig({
      config: newConfig,
      oldConfig,
      guild,
    })}${warningsMessage}`,
    allowedMentions: { parse: [] },
  })
}

export interface ReportConfigResolved {
  config: ReportConfig
  reportChannel: GuildTextBasedChannel
}

export async function fetchConfig(
  guild: Guild,
  user: User,
): Promise<ReportConfigResolved> {
  const config = await prisma.reportConfig.findUnique({
    where: {
      guildID: guild.id,
    },
  })

  if (!config) {
    throw new Error('The report system has not been configured for this guild.')
  }

  if (!config.enabled) {
    throw new Error('The report system is disabled for this guild.')
  }

  if (!config.channelID) {
    throw new Error(
      'The report channel has not been set. You should let the staff team know.',
    )
  }

  const reportChannel = await guild.channels.fetch(config.channelID)

  if (!reportChannel) {
    throw new Error(
      'The report channel has been deleted or is not accessible. You should let the staff team know.',
    )
  }

  if (!reportChannel.isTextBased()) {
    throw new Error(
      'The report channel is not a text channel. You should let the staff team know.',
    )
  }

  const reportBlock = await prisma.reportBan.findUnique({
    where: {
      guildID_userID: {
        guildID: guild.id,
        userID: user.id,
      },
    },
  })

  if (reportBlock) {
    throw new Error(
      'You have been blocked from using the report system in this guild.',
    )
  }

  return {
    config,
    reportChannel,
  }
}
