import type { Prisma } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  ChannelType,
  type ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { prisma } from '../../../util/db.js'
import { formatConfig, makeForumTagFormatter } from '../../../util/format.js'
import { createTagAutocomplete } from '../ticket/create_button.js'

const tagAutocomplete = createTagAutocomplete('forum')

export const modmail_forum_config = new SleetSlashSubcommand(
  {
    name: 'config',
    description: 'Configure settings for a forum channel',
    options: [
      {
        name: 'forum',
        description: 'The forum channel to configure',
        type: ApplicationCommandOptionType.Channel,
        channel_types: [ChannelType.GuildForum],
        required: true,
      },
      {
        name: 'open_tag',
        description: 'The tag to use for open tickets',
        type: ApplicationCommandOptionType.String,
        autocomplete: tagAutocomplete,
      },
      {
        name: 'closed_tag',
        description: 'The tag to use for closed tickets',
        type: ApplicationCommandOptionType.String,
        autocomplete: tagAutocomplete,
      },
    ],
  },
  {
    run: runConfigForum,
  },
)

async function runConfigForum(interaction: ChatInputCommandInteraction) {
  const forum = interaction.options.getChannel('forum', true, [
    ChannelType.GuildForum,
  ])
  const openTag = interaction.options.getString('open_tag')
  const closedTag = interaction.options.getString('closed_tag')

  await interaction.deferReply()

  const guild = await getGuild(interaction, true)

  const mergedConfig: Omit<Prisma.ModMailForumConfigCreateInput, 'updatedAt'> =
    {
      guildID: guild.id,
      channelID: forum.id,
    }

  if (openTag) {
    mergedConfig.openTag = openTag
  }

  if (closedTag) {
    mergedConfig.closedTag = closedTag
  }

  const newConfig = await prisma.modMailForumConfig.upsert({
    where: {
      guildID_channelID: {
        guildID: guild.id,
        channelID: forum.id,
      },
    },
    update: mergedConfig,
    create: mergedConfig,
  })

  const tagFormatter = makeForumTagFormatter(forum)

  await interaction.editReply({
    content: `Forum modmail config updated:\n${formatConfig({
      config: newConfig,
      guild,
      formatters: {
        openTag: tagFormatter,
        closedTag: tagFormatter,
      },
    })}`,
    allowedMentions: { parse: [] },
  })
}
