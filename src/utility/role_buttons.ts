import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  type Interaction,
  InteractionContextType,
  MessageFlags,
  type Role,
  codeBlock,
} from 'discord.js'
import { SleetSlashCommand, getGuild } from 'sleetcord'

export const role_buttons = new SleetSlashCommand(
  {
    name: 'role_buttons',
    description:
      'Create a set of buttons for users to add/remove roles from themselves',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    default_member_permissions: ['ManageGuild'],
    options: [
      {
        name: 'roles',
        description:
          'The roles to made buttons for (format: `@role1 role 2 description @role2 🦀 crab role @crab`)',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'description',
        description: 'Add a description to the role buttons (default: None)',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'embed',
        description:
          'Show an embed with a description and list of roles (default: true)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'only_one',
        description:
          'Only allow one role to be selected at a time (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runRoleButtons,
    interactionCreate: handleInteractionCreate,
  },
)

const FORMAT_REGEX =
  /\s*(?<emoji>(?:\p{RGI_Emoji}|<(?<animated>a?):\w+:(?<emote>\d{17,20})>))?\s*(?<description>.*?)??\s*<@&(?<roleId>\d{17,20})>/gv

interface FormatGroups {
  emoji?: string
  animated?: string
  emote?: string
  description?: string
  roleId: string
}

async function runRoleButtons(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  if (!interaction.inGuild()) return
  const member =
    interaction.member instanceof GuildMember
      ? interaction.member
      : await guild.members.fetch(interaction.member.user.id)

  const roles = interaction.options.getString('roles', true)
  const description = interaction.options.getString('description') ?? ''
  const includeEmbed = interaction.options.getBoolean('embed') ?? true
  const onlyOne = interaction.options.getBoolean('only_one') ?? false

  const userHighestRolePosition = member.roles.highest.position
  const botHighestRolePosition = member.roles.highest.position

  const parsedRoles = Array.from(roles.matchAll(FORMAT_REGEX)).map(
    (v) => v.groups as unknown as FormatGroups,
  )

  if (parsedRoles.length === 0) {
    await interaction.reply({
      content:
        'Failed to parse any roles to show, did you use the right format?\n`[emoji|custom emote] [description] @Role Mention` 1 or more times.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const fails: string[] = []
  const embed = new EmbedBuilder()
  const rows: ActionRowBuilder<ButtonBuilder>[] = []
  const fields: string[] = []

  const desc =
    description +
    (onlyOne ? '\n\nYou can only have **one** role at a time.' : '')

  if (desc) {
    embed.setDescription(desc)
  }

  let row = new ActionRowBuilder<ButtonBuilder>()

  for (const role of parsedRoles) {
    const roleObj = guild.roles.cache.get(role.roleId)

    if (!roleObj) {
      fails.push(
        `Failed to find the role ${role.roleId} in the guild, does it exist?`,
      )
    } else if (roleObj.position >= userHighestRolePosition) {
      fails.push(
        `You cannot add ${roleObj.name} as an assignable role as it is higher than or equal to your highest role.`,
      )
    } else if (roleObj.position >= botHighestRolePosition) {
      fails.push(
        `You cannot add ${roleObj.name} as an assignable role as it is higher than or equal to my highest role.`,
      )
    } else if (roleObj.managed) {
      fails.push(
        `You cannot add ${roleObj.name} as an assignable role as it is managed by an integration.`,
      )
    } else {
      if (row.components.length === 5) {
        rows.push(row)
        row = new ActionRowBuilder<ButtonBuilder>()
      }

      const button = new ButtonBuilder()
        .setCustomId(`${ROLE_BUTTON_ID}:${roleObj.id}:${onlyOne}`)
        .setLabel(role.description ?? roleObj.name)
        .setStyle(ButtonStyle.Secondary)

      const buttonEmoji = role.emote ?? role.emoji

      if (buttonEmoji) {
        button.setEmoji(buttonEmoji)
      }

      const displayEmoji = role.emote
        ? `<${role.animated ? 'a' : ''}:_:${role.emote}>`
        : role.emoji

      fields.push(
        `${displayEmoji ? `${displayEmoji} ` : ''}${roleObj}${
          role.description ? ` - ${role.description}` : ''
        }`,
      )

      row.addComponents([button])
    }
  }

  if (fails.length > 0) {
    await interaction.reply({
      content: `Found some issues while trying to setup roles, try again:\n${codeBlock(fails.join('\n'))}`,
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  rows.push(row)
  embed.addFields([
    {
      name: 'Roles',
      value: fields.join('\n'),
    },
  ])

  await interaction.channel?.send({
    content: includeEmbed ? '' : description,
    embeds: includeEmbed ? [embed] : [],
    components: rows,
  })

  await interaction.reply({
    content: 'Role buttons sent!',
    flags: MessageFlags.Ephemeral,
  })
}

const ROLE_BUTTON_ID = 'role-button'

async function handleInteractionCreate(interaction: Interaction) {
  if (!interaction.isButton()) return

  const [command, roleID, onlyOneStr] = interaction.customId.split(':')
  const onlyOne = onlyOneStr === 'true'

  if (command !== ROLE_BUTTON_ID) return

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  })

  const guild = await getGuild(interaction, true)
  if (!interaction.inGuild()) return

  const member =
    interaction.member instanceof GuildMember
      ? interaction.member
      : await guild.members.fetch(interaction.member.user.id)

  const role = guild.roles.cache.get(roleID)

  if (!role) {
    await interaction.editReply({
      content: "That role doesn't seem to exist, maybe it was deleted?",
    })
    return
  }

  const removeRoles: Role[] = []

  if (onlyOne) {
    const otherRoles: Role[] = []

    for (const row of interaction.message.components) {
      for (const button of row.components) {
        if (button.customId === interaction.customId || !button.customId) {
          continue
        }

        const otherRole = guild.roles.cache.get(button.customId.split(':')[1])

        if (otherRole) {
          otherRoles.push(otherRole)
        }
      }
    }

    if (otherRoles.length > 0) {
      removeRoles.push(
        ...otherRoles.filter((r) => member.roles.cache.has(r.id)),
      )
    }
  }

  const addendum =
    removeRoles.length > 0 ? ` and lost ${removeRoles.join(', ')}` : ''

  const memberRoles = member.roles.cache
    .toJSON()
    .filter((r) => removeRoles.every((rr) => rr.id !== r.id))

  if (!member.roles.cache.has(role.id)) {
    memberRoles.push(role)
    await member.roles.set(memberRoles)
    await interaction.editReply({
      content: `You now have the ${role} role${addendum}.`,
    })
  } else {
    memberRoles.splice(memberRoles.indexOf(role), 1)
    await member.roles.set(memberRoles)
    await interaction.editReply({
      content: `You no longer have the ${role} role${addendum}.`,
    })
  }
}
