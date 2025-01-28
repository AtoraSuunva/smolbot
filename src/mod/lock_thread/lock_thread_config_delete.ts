import {
  ApplicationCommandOptionType,
  ChannelType,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { formatConfig } from '../../util/format.js'

export const lock_thread_config_delete = new SleetSlashSubcommand(
  {
    name: 'delete',
    description: 'Delete the config for a specific forum',
    options: [
      {
        name: 'source_channel',
        description:
          'Channel to delete the config in, where threads are being locked',
        type: ApplicationCommandOptionType.Channel,
        channel_types: [
          ChannelType.GuildForum,
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildMedia,
        ],
        required: true,
      },
    ],
  },
  {
    run: runLockThreadConfig,
  },
)

async function runLockThreadConfig(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const sourceChannel = interaction.options.getChannel('source_channel', true)

  const oldConfig = await prisma.lockThreadConfig.findFirst({
    where: {
      sourceChannelID: sourceChannel.id,
    },
  })

  if (!oldConfig) {
    interaction.reply({
      content: `There is no old config to delete for ${sourceChannel}`,
      flags: MessageFlags.Ephemeral,
    })

    return
  }

  await prisma.lockThreadConfig.delete({
    where: {
      sourceChannelID: sourceChannel.id,
    },
  })

  return interaction.reply({
    content: `Lock Thread deleted, previous config:\n${formatConfig({
      config: oldConfig,
      guild,
    })}`,
    allowedMentions: { parse: [] },
  })
}
