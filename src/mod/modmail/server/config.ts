import type { Prisma } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { prisma } from '../../../util/db.js'
import { formatConfig } from '../../../util/format.js'

export const modmail_server_config = new SleetSlashSubcommand(
  {
    name: 'config',
    description: 'Configure modmail settings for the server',
    options: [
      {
        name: 'mod_reply_prefix',
        description:
          'Prefix for mods to send replies as themselves (default: "!r")',
        type: ApplicationCommandOptionType.String,
        min_length: 1,
        max_length: 100,
      },
      {
        name: 'mod_anon_reply_prefix',
        description:
          'Prefix for mods to send replies anonymously as staff (default: "!a")',
        type: ApplicationCommandOptionType.String,
        min_length: 1,
        max_length: 100,
      },
      {
        name: 'mod_team_name',
        description:
          'Name to use for anonymous staff replies (default: "Mod Team")',
        type: ApplicationCommandOptionType.String,
        min_length: 2,
        max_length: 32,
      },
    ],
  },
  {
    run: runConfigServer,
  },
)

async function runConfigServer(interaction: ChatInputCommandInteraction) {
  const modReplyPrefix = interaction.options.getString('mod_reply_prefix')
  const modAnonReplyPrefix = interaction.options.getString(
    'mod_anon_reply_prefix',
  )
  const modTeamName = interaction.options.getString('mod_team_name')

  if (modTeamName && !isValidUsername(modTeamName)) {
    await interaction.reply({
      content:
        "Mod team name is an invalid username, [see Discord's documentation](<https://discord.com/developers/docs/resources/user#usernames-and-nicknames>) for details",
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.deferReply()

  const guild = await getGuild(interaction, true)

  const mergedConfig: Omit<Prisma.ModMailConfigCreateInput, 'updatedAt'> = {
    guildID: guild.id,
  }

  if (modAnonReplyPrefix) {
    mergedConfig.modAnonReplyPrefix = modAnonReplyPrefix
  }

  if (modReplyPrefix) {
    mergedConfig.modReplyPrefix = modReplyPrefix
  }

  if (modTeamName) {
    mergedConfig.modTeamName = modTeamName
  }

  const newConfig = await prisma.modMailConfig.upsert({
    where: {
      guildID: guild.id,
    },
    update: mergedConfig,
    create: mergedConfig,
  })

  await interaction.editReply({
    content: `Server modmail config updated:\n${formatConfig({
      config: newConfig,
      guild,
    })}`,
    allowedMentions: { parse: [] },
  })
}

const invalidSubstrings = /@|#|:|```|discord/i

/**
 * Checks a username for the basic invalid username rules, Discord does a couple unknown checks on their end so this isn't exhaustive
 *
 * See https://discord.com/developers/docs/resources/user#usernames-and-nicknames
 * @param username The username to validate
 * @returns If the username passes some basic validation
 */
function isValidUsername(username: string): boolean {
  return (
    username.length >= 2 &&
    username.length <= 32 &&
    !username.match(invalidSubstrings) &&
    username !== 'everyone' &&
    username !== 'here'
  )
}
