import type { Prisma, WelcomeSettings } from '@prisma/client'
import {
  type APIEmbedField,
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  Constants,
  EmbedBuilder,
} from 'discord.js'
import {
  SleetSlashSubcommand,
  getGuild,
  getRoles,
  getTextBasedChannel,
} from 'sleetcord'
import { getOptionCount } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { welcomeCache } from './cache.js'

type NewWelcomeSettings = Prisma.WelcomeSettingsCreateInput | null

export const config = new SleetSlashSubcommand(
  {
    name: 'config',
    description: 'View or edit the welcome config.',
    options: [
      {
        name: 'message',
        description:
          'The welcome message, see `/welcome message`. (default: "Welcome {@user}!")',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'channel',
        description:
          'A specific channel to send the message in, if any. (default: "none")',
        type: ApplicationCommandOptionType.Channel,
        channel_types: Constants.GuildTextBasedChannelTypes,
      },
      {
        name: 'unset_channel',
        description:
          'Reset to sending welcome messages to the same channel as the first message',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'rejoins',
        description:
          'Re-welcome users if they leave and rejoin after previously being welcome (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'instant',
        description:
          'Send the welcome message instantly, or wait for first message (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'ignore_roles',
        description: 'Ignore users with these roles (default: "none")',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'react_with',
        description:
          'React to the user\'s first message with this emoji (default: "none")',
        type: ApplicationCommandOptionType.String,
      },
    ],
  },
  {
    run: runConfig,
  },
)

const unicodeEmojiRegex = /\p{RGI_Emoji}/gv
const discordEmojiRegex = /<(?<animated>a)?:(?<name>\w{2,}):(?<id>\d+)>/

function getEmoji(
  interaction: ChatInputCommandInteraction,
  name: string,
  required = false,
): string | null {
  const option = interaction.options.getString(name, required)

  if (option === null) {
    return null
  }

  const unicodeEmoji = option.match(unicodeEmojiRegex)

  if (unicodeEmoji) {
    return unicodeEmoji[0]
  }

  const discordEmoji = option.match(discordEmojiRegex)

  if (discordEmoji) {
    return discordEmoji[0]
  }

  return null
}

async function runConfig(interaction: ChatInputCommandInteraction) {
  const defer = interaction.deferReply()

  const guild = await getGuild(interaction, true)

  const oldConfig = await prisma.welcomeSettings.findUnique({
    where: {
      guildID: guild.id,
    },
  })

  await defer

  // No options specified, show the current settings
  if (getOptionCount(interaction) === 0) {
    if (!oldConfig) {
      return interaction.editReply({
        content:
          "You don't have an existing welcome config, use `/welcome config` with options to create one.",
      })
    }

    const embed = createWelcomeEmbed(oldConfig)
    return interaction.editReply({
      content: 'These are your current settings',
      embeds: [embed],
    })
  }

  // Settings specified, edit the current settings

  const message = interaction.options.getString('message')
  // Can be unset
  const channel = await getTextBasedChannel(interaction, 'channel')
  const unsetChannel = interaction.options.getBoolean('unset_channel')
  const rejoins = interaction.options.getBoolean('rejoins')
  const instant = interaction.options.getBoolean('instant')
  // Can be empty
  const ignoreRolesOption = await getRoles(interaction, 'ignore_roles')
  const ignoreRoles =
    ignoreRolesOption?.map((role) => role.id).join(',') ?? null
  // Can be unset
  const reactWith = getEmoji(interaction, 'react_with')
  const reactWithOption = interaction.options.get('react_with')

  // Clone the old welcome so we can show a diff
  let newWelcome: NewWelcomeSettings = structuredClone(oldConfig)
  const changes: string[] = []

  if (!oldConfig || !newWelcome) {
    // No previous welcome, create a new one
    newWelcome = {
      guildID: guild.id,
      message: message ?? 'Welcome {@user}!',
      channel: channel?.id ?? null,
      rejoins: rejoins ?? false,
      instant: instant ?? false,
      ignoreRoles: ignoreRoles ?? '',
      reactWith: reactWith,
    }
  } else {
    // Previous welcome, edit it
    if (message !== null) {
      newWelcome.message = message
      changes.push('message')
    }

    if (channel !== null) {
      newWelcome.channel = channel.id
      changes.push('channel')
    }

    if (unsetChannel === true) {
      newWelcome.channel = null
      changes.push('channel')
    }

    if (rejoins !== null) {
      newWelcome.rejoins = rejoins
      changes.push('rejoins')
    }

    if (instant !== null) {
      newWelcome.instant = instant
      changes.push('instant')
    }

    if (ignoreRoles !== null) {
      newWelcome.ignoreRoles = ignoreRoles
      changes.push('ignore_roles')
    }

    if (reactWith !== null) {
      newWelcome.reactWith = reactWith
      changes.push('react_with')
    }

    if (String(reactWithOption?.value).toLowerCase() === 'none') {
      newWelcome.reactWith = null
      changes.push('react_with')
    }
  }

  // There's an old config and no changes were made
  if (oldConfig && changes.length === 0) {
    return interaction.editReply({
      content: 'No changes made, failed to parse your options',
    })
  }

  const updatedWelcome = await prisma.welcomeSettings.upsert({
    where: {
      guildID: guild.id,
    },
    create: newWelcome,
    update: newWelcome,
  })

  welcomeCache.set(guild.id, updatedWelcome)

  const oldSettings = createWelcomeEmbed(oldConfig).setFooter({
    text: 'Old settings',
  })
  const newSettings = createWelcomeEmbed(updatedWelcome, changes).setFooter({
    text: 'New settings',
  })

  return interaction.editReply({
    content: 'Updated your settings',
    embeds: [oldSettings, newSettings],
  })
}

const displayFormatters = {
  channel: (c: string | null) => (c ? `<#${c}>` : 'Same channel'),
  ignore_roles: (r: string) =>
    r
      .split(',')
      .filter((v) => v.trim() !== '')
      .map((i) => `<@&${i}>`)
      .join(', ') || 'None',
  react_with: (r: string | null) => r ?? 'None',
}

function createWelcomeEmbed(
  welcome: WelcomeSettings | null,
  changes: string[] = [],
): EmbedBuilder {
  if (welcome === null) {
    return new EmbedBuilder()
      .setTitle('No welcome config.')
      .setDescription('Any missing settings will be set to defaults.')
  }

  const fields: APIEmbedField[] = [
    { name: 'message', value: welcome.message, inline: true },
    {
      name: 'channel',
      value: displayFormatters.channel(welcome.channel),
      inline: true,
    },
    { name: 'rejoins', value: String(welcome.rejoins), inline: true },
    { name: 'instant', value: String(welcome.instant), inline: true },
    {
      name: 'ignore_roles',
      value: displayFormatters.ignore_roles(welcome.ignoreRoles),
      inline: true,
    },
    {
      name: 'react_with',
      value: displayFormatters.react_with(welcome.reactWith),
      inline: true,
    },
  ].map((field) => ({
    ...field,
    name: changes.includes(field.name) ? `🟡 ${field.name}` : field.name,
  }))

  return new EmbedBuilder().addFields(fields)
}
