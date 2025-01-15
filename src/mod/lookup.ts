import {
  type APIApplication,
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  type Client,
  type Collection,
  DiscordAPIError,
  EmbedBuilder,
  GuildNSFWLevel,
  type GuildPreview,
  type GuildPreviewEmoji,
  GuildVerificationLevel,
  type Interaction,
  InteractionContextType,
  type Invite,
  MessageFlags,
  SnowflakeUtil,
  type Sticker,
  User,
  UserFlags,
  Widget,
  codeBlock,
  escapeInlineCode,
  time,
} from 'discord.js'
import prettyMilliseconds from 'pretty-ms'
import { SleetSlashCommand, formatUser, isLikelyID } from 'sleetcord'
import { plural } from '../util/format.js'

export const lookup = new SleetSlashCommand(
  {
    name: 'lookup',
    description: 'Lookup a user, guild, or invite :)',
    contexts: [
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ],
    integration_types: [
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ],
    options: [
      {
        name: 'data',
        description: 'The data to lookup (user ID, guild ID, invite code)',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'ephemeral',
        type: ApplicationCommandOptionType.Boolean,
        description: 'Only show the result to you (default: False)',
      },
    ],
  },
  {
    run: runLookup,
    interactionCreate,
  },
)

const LOOKUP_ID = 'lookup'

async function interactionCreate(interaction: Interaction) {
  if (
    interaction.isButton() &&
    interaction.customId.startsWith(`${LOOKUP_ID}:`)
  ) {
    const [, data, ephemeral] = interaction.customId.split(':')
    await lookupAndRespond(interaction, data, ephemeral === 'true').catch(
      () => {
        /* ignore */
      },
    )
    // Then disable the button
    await interaction.message
      .edit({
        components: [],
      })
      .catch(() => {
        /* ignore */
      })
  }
}

async function runLookup(interaction: ChatInputCommandInteraction) {
  const data = interaction.options.getString('data', true)
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  await lookupAndRespond(interaction, data, ephemeral)
}

type LookupInteraction = ChatInputCommandInteraction | ButtonInteraction

async function lookupAndRespond(
  interaction: LookupInteraction,
  data: string,
  ephemeral: boolean,
) {
  const { client } = interaction

  await interaction.deferReply({
    flags: ephemeral ? MessageFlags.Ephemeral : '0',
  })

  let error: unknown | null

  if (isLikelyID(data)) {
    // Probably an ID, check if it's a user or guild
    try {
      const user = await client.users.fetch(data)
      return sendUserLookup(interaction, user)
    } catch (e) {
      error = e
    }

    try {
      const guild = await fetchGuild(client, data)

      if ('message' in guild) {
        return interaction.editReply(guild.message)
      }

      if (guild instanceof Widget) {
        if (guild.instantInvite) {
          return sendInviteLookup(
            interaction,
            await client.fetchInvite(guild.instantInvite),
            ephemeral,
          )
        }

        return sendGuildWidgetLookup(interaction, guild)
      }

      return sendGuildPreviewLookup(interaction, guild)
    } catch (e) {
      error = e
    }
  } else {
    // Likely an invite code
    try {
      const invite = await client.fetchInvite(data)
      return sendInviteLookup(interaction, invite, ephemeral)
    } catch (e) {
      error = e
    }
  }

  await interaction.editReply(`Failed to do lookup, got:\n> ${String(error)}`)
}

interface GuildExists {
  exists: boolean
  message: string
}
type GuildData = GuildExists | GuildPreview | Widget

/**
 * Tries to get info about a guild from just an ID, using the widget
 * @param client The client to use for the request
 * @param guildId The guild ID to fetch with
 * @returns Guild data if the guild ID is valid, either "this exists" or details if the widget exists
 * @throws Error if the guild ID is invalid
 */
async function fetchGuild(client: Client, guildId: string): Promise<GuildData> {
  try {
    return await client.fetchGuildPreview(guildId)
  } catch (e) {
    // ignore
  }

  try {
    return await client.fetchGuildWidget(guildId)
  } catch (e) {
    if (e instanceof DiscordAPIError) {
      if (e.status === 403) {
        return {
          exists: true,
          message: `Guild found with ID "\`${guildId}\`", no more information found.\nGuild created at: ${formatDate(
            snowflakeToDate(guildId),
          )}`,
        }
      }

      if (e.status === 404) {
        return {
          exists: false,
          message: `No guild with ID "\`${guildId}\`" not found.`,
        }
      }
    }
  }

  throw new Error('Failed to fetch guild preview and widget.')
}

/**
 * Try to fetch a guild preview for a guild
 * @param client The client to use for the request
 * @param guildId The guild ID to fetch with
 * @returns Either a GuildPreview (if available) or null
 */
async function tryFetchGuildPreview(
  client: Client,
  guildId: string,
): Promise<GuildPreview | null> {
  try {
    return await client.fetchGuildPreview(guildId)
  } catch (e) {
    return null
  }
}

const rpcUrl = (app: string) =>
  `https://discord.com/api/applications/${app}/rpc`
const oAuthUrl = (app: string) =>
  `https://discord.com/oauth2/authorize?client_id=${app}`
const oAuthUrlScoped = (app: string, permissions: string, scopes: string[]) =>
  `${oAuthUrl(app)}&permissions=${permissions}&scope=${encodeURIComponent(
    scopes.join(' '),
  )}`

/**
 * Try to get some details about a bot using the RPC API info
 * @param app The application to lookup
 * @returns RPC details for a bot/application, if available
 * @throws Error if the application is not a bot or doesn't exist, *or* if the bot is old enough that bot ID != application ID
 */
async function fetchRPCDetails(app: string): Promise<APIApplication> {
  const res = await fetch(rpcUrl(app))

  if (res.status === 404) {
    throw new Error('No application found or snowflake incorrect.')
  }

  if (res.status === 200) {
    return res.json() as Promise<APIApplication>
  }

  throw new Error('Failed to fetch application RPC details.')
}

/**
 * Try to fetch some details about a bot using the RPC API info, returning null on failure
 * @param app The application to lookup
 * @returns RPC details for a bot/application, if available
 */
async function tryFetchRPCDetails(app: string): Promise<APIApplication | null> {
  try {
    return await fetchRPCDetails(app)
  } catch {
    return null
  }
}

const Badges: Record<keyof typeof UserFlags, string> = {
  Staff: '<:BadgeStaff:909313939911897138>',
  Partner: '<:BadgePartner:909313940725571604>',
  Hypesquad: '<:BadgeHypeSquadEvents:909313941178548246>',
  BugHunterLevel1: '<:BadgeBugHunter:909313942407483402>',
  HypeSquadOnlineHouse1: '<:BadgeBravery:909313943233789972>',
  HypeSquadOnlineHouse2: '<:BadgeBrilliance:909313944047468544>',
  HypeSquadOnlineHouse3: '<:BadgeBalance:909313944869564416>',
  PremiumEarlySupporter: '<:BadgeEarlySupporter:909313946132029440>',
  TeamPseudoUser: '[Team User]',
  BugHunterLevel2: '<:BadgeBugHunterLvl2:909313947172233266>',
  VerifiedBot: '<:VerifiedBot:910427927160709180>',
  VerifiedDeveloper: '<:BadgeEarlyVerifiedBotDeveloper:909313948355018752>',
  CertifiedModerator: '<:BadgeModeratorProgramsAlumni:1242694571385946152>',
  BotHTTPInteractions: '[HTTP Interactions]',
  ActiveDeveloper: '<:activeDev:1242646832828387500>',

  // Not officially documented, but "known"
  Spammer: '[Spammer]',
  Quarantined: '[Quarantined]',
  Collaborator: '[Collaborator]',
  DisablePremium: '[DisablePremium]',
  HasUnreadUrgentMessages: '[HasUnreadUrgentMessages]',
  MFASMS: '[MFA SMS]',
  PremiumPromoDismissed: '[PremiumPromoDismissed]',
  RestrictedCollaborator: '[RestrictedCollaborator]',
}

/**
 * Pretty-format badges by turning them into emojis!
 * @param user The user to get details for
 * @returns An array of badge emojis/text that can be displayed
 */
function getUserBadgeEmojis(user: User): string[] {
  if (!user.flags) return []

  const badges: string[] = []

  // Object.entries(UserFlags) returns an array of:
  //   - ['StringName', bit]
  //   - ['BitString', 'StringName']
  // Where 'StringName' is 'Staff', 'Partner', etc.
  //       bit is 0b1, 0b10, 0b100, etc. (1, 2, 4, etc.)
  //       'BitString' is '1', '2', '4' etc.
  // UserFlags is both a map 'string' -> bit and bit -> 'string'
  for (const [key, flag] of Object.entries(UserFlags)) {
    if (
      typeof flag === 'number' &&
      key !== 'VerifiedBot' &&
      user.flags.has(flag) &&
      key in Badges
    ) {
      badges.push(Badges[key as keyof typeof Badges])
    }
  }

  return badges
}

/**
 * Send a lookup about a user, including extra details for bot users
 * @param interaction The interaction to edit
 * @param user The user ID to lookup
 */
async function sendUserLookup(
  interaction: LookupInteraction,
  user: User,
): Promise<void> {
  if (!(user instanceof User)) {
    return void interaction
      .editReply('Did not find info for that user.')
      .catch(() => {
        /* ignore */
      })
  }

  const rawUser = `\`\`${escapeInlineCode(user.discriminator === '0' ? user.username : user.tag)}\`\``
  const badges = getUserBadgeEmojis(user)
  const formattedBadges =
    badges.length > 0 ? `\n**Badges:** ${badges.join(' ')}` : ''

  const components: ActionRowBuilder<ButtonBuilder>[] = []
  const embed = new EmbedBuilder()
    .setTitle(
      user.discriminator === '0'
        ? user.username
        : formatUser(user, {
            id: false,
            markdown: false,
            escapeMarkdown: false,
          }),
      // Use format user to add in the bidi control characters before the #
    )
    .setThumbnail(user.displayAvatarURL({ size: 4096 }))
    .setDescription(
      `${user}\n**ID:** ${user.id}\n**Raw Username:** ${rawUser}${formattedBadges}`,
    )
    .addFields([{ name: 'Created at:', value: formatDate(user.createdAt) }])

  if (user.globalName) {
    embed.setAuthor({
      name: user.globalName,
    })
  }

  if (typeof user.accentColor === 'number') {
    embed.setColor(user.accentColor)
  }

  if (user.banner) {
    // biome-ignore lint/style/noNonNullAssertion: we just checked the url exists
    embed.setImage(user.bannerURL({ size: 4096 })!)
  }

  if (user.bot) {
    const verifiedBot = user.flags?.has('VerifiedBot')
    const rpc = await tryFetchRPCDetails(user.id)
    const details: string[] = []

    if (verifiedBot) {
      details.push(`${Badges.VerifiedBot} **Verified Bot**\n`)
    }

    if (rpc) {
      const row = new ActionRowBuilder<ButtonBuilder>()
      components.push(row)

      const inviteUrl = oAuthUrl(rpc.id)
      row.addComponents([
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('Invite')
          .setURL(inviteUrl),
      ])

      const inviteUrlScoped = oAuthUrlScoped(
        rpc.id,
        rpc.install_params?.permissions ?? '0',
        rpc.install_params?.scopes ?? ['bot'],
      )
      row.addComponents([
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('Invite (Scoped)')
          .setURL(inviteUrlScoped),
      ])

      const availability = rpc.bot_public ? 'Public' : 'Private'

      details.push(
        `> ${rpc.description.trim().replaceAll(/\n/g, '\n> ')}\n`,
        `**${availability} Bot**`,
      )

      if (rpc.terms_of_service_url) {
        row.addComponents([
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Terms of Service')
            .setURL(rpc.terms_of_service_url),
        ])
      }

      if (rpc.privacy_policy_url) {
        row.addComponents([
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Privacy Policy')
            .setURL(rpc.privacy_policy_url),
        ])
      }

      if (rpc.guild_id) {
        details.push(`**Guild:** \`${rpc.guild_id}\``)
      }

      if (rpc.tags) {
        details.push(`**Tags:** ${rpc.tags.map((t) => `\`${t}\``).join(', ')}`)
      }

      row.addComponents([
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('RPC Details')
          .setURL(rpcUrl(rpc.id)),
      ])
    } else {
      details.push('No RPC information available. This bot is likely too old.')
    }

    const formattedDetails = details.join('\n').trim()
    embed.addFields([{ name: 'Bot Details:', value: formattedDetails }])
  }

  await interaction.editReply({ components, embeds: [embed] })
}

const ONLINE = '<:i_online:468214881623998464>'
const OFFLINE = '<:i_offline2:468215162244038687>'
const PARTNERED = '<:serverPartnered:1242647914119954484>'
const VERIFIED = '<:serverVerifiedIcon:1242647914917003285>'

/**
 * Send a guild or group DM invite based on which kind of invite it is
 * @param interaction The interaction to edit
 * @param invite The invite to use
 */
async function sendInviteLookup(
  interaction: LookupInteraction,
  invite: Invite,
  ephemeral: boolean,
): Promise<void> {
  if (invite.guild) {
    // Guild Invite
    return sendGuildInviteLookup(interaction, invite, ephemeral)
  }

  // Group DM invite? Maybe something else?
  return sendGroupDMInviteLookup(interaction, invite)
}

/**
 * Sends all available information about a guild using an invite and Guild Preview API (if available)
 * @param interaction The interaction to edit
 * @param invite The invite to fetch information from
 */
async function sendGuildInviteLookup(
  interaction: LookupInteraction,
  invite: Invite,
  ephemeral: boolean,
): Promise<void> {
  const { guild, code, presenceCount, memberCount } = invite

  if (!guild) {
    return void interaction.editReply('Not a guild invite!').catch(() => {
      /* ignore */
    })
  }

  const preview = await tryFetchGuildPreview(interaction.client, guild.id)
  const ratio = ((presenceCount / memberCount) * 100).toFixed(0)
  const guildIcons = [
    guild.partnered ? PARTNERED : '',
    guild.verified ? VERIFIED : '',
  ].filter((v) => !!v)
  const guildPrepend = guildIcons.length > 0 ? `${guildIcons.join(' ')} ` : ''

  const components = new ActionRowBuilder<ButtonBuilder>()
  const embed = new EmbedBuilder()
    .setTitle(`📨 • Guild Invite: ${code}`)
    .setThumbnail(guild.iconURL({ size: 4096 }))
    .setDescription(guild.description)
    .addFields([
      {
        name: 'Guild Info:',
        value: `${guildPrepend}${guild.name}\n**ID:** ${guild.id}\n[#${
          invite.channel?.name ?? 'unknown channel'
        }](http://discord.com)`,
        inline: true,
      },
      {
        name: 'Members:',
        value:
          `${ONLINE} **${presenceCount.toLocaleString()}** Online (${ratio}%)\n` +
          `${OFFLINE} **${memberCount.toLocaleString()}** Total`,
        inline: true,
      },
      {
        name: 'Guild Created:',
        value: formatDate(guild.createdAt),
      },
    ])
    .setFooter({
      text: `Source: Invite${preview ? ' & Guild Preview' : ''}`,
    })

  if (invite.expiresAt) {
    embed.addFields([
      {
        name: 'Invite Expires:',
        value: formatDate(invite.expiresAt),
      },
    ])
  }

  if (invite.inviter) {
    embed.addFields([
      { name: 'Inviter:', value: formatUser(invite.inviter), inline: true },
    ])

    components.addComponents([
      new ButtonBuilder()
        .setEmoji('📫')
        .setLabel('Lookup Inviter')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(`${LOOKUP_ID}:${invite.inviter.id}:${ephemeral}`),
    ])
  }

  if (guild.features.length > 0) {
    embed.addFields([
      {
        name: 'Features:',
        value: codeBlock(guild.features.sort().join(', ')),
      },
    ])
  }

  if (preview) {
    if (preview.emojis.size > 0) {
      embed.addFields([
        {
          name: `Emojis (${preview.emojis.size}):`,
          value: formatPreviewEmojis(preview.emojis),
        },
      ])
    }

    if (preview.stickers.size > 0) {
      embed.addFields([
        {
          name: `Stickers (${preview.stickers.size}):`,
          value: formatStickers(preview.stickers),
        },
      ])
    }
  }

  const images: string[] = []

  if (guild.splash) {
    // biome-ignore lint/style/noNonNullAssertion: we just checked the url exists
    images.push(`[Splash](${guild.splashURL({ size: 4096 })!})`)
  }

  if (guild.banner) {
    // biome-ignore lint/style/noNonNullAssertion: we just checked the url exists
    images.push(`[Banner](${guild.bannerURL({ size: 4096 })!})`)
  }

  if (images.length > 0) {
    embed.addFields([
      {
        name: 'Images:',
        value: images.join(' — '),
        inline: true,
      },
    ])
  }

  embed.addFields([
    {
      name: 'Verification Level:',
      value: VerificationLevelMap[guild.verificationLevel],
      inline: true,
    },
    {
      name: 'NSFW Level:',
      value: NSFWLevelMap[guild.nsfwLevel],
      inline: true,
    },
  ])

  if (guild.premiumSubscriptionCount !== null) {
    embed.addFields({
      name: 'Boosts:',
      value: guild.premiumSubscriptionCount.toLocaleString(),
      inline: true,
    })
  }

  if (guild.vanityURLCode) {
    embed.addFields([
      {
        name: 'Vanity URL:',
        value: `[/${guild.vanityURLCode}](https://discord.gg/${guild.vanityURLCode})`,
        inline: true,
      },
    ])
  }

  await interaction.editReply({
    embeds: [embed],
    components: components.components.length > 0 ? [components] : [],
  })
}

/**
 * Sends all available information about a Group DM using an invite
 * @param interaction The interaction to reply to
 * @param invite The invite to send data for
 */
async function sendGroupDMInviteLookup(
  interaction: LookupInteraction,
  invite: Invite,
): Promise<void> {
  const { code, guild } = invite

  if (guild) {
    await interaction.editReply('Not a group DM invite!')
    return
  }

  if (!invite.channel || invite.channel.type !== ChannelType.GroupDM) {
    await interaction.editReply('Failed to fetch group DM channel!')
    return
  }

  const createdAt = snowflakeToDate(invite.channel.id)

  const components = new ActionRowBuilder<ButtonBuilder>()
  const embed = new EmbedBuilder()
    .setTitle(`:incoming_envelope:  Group DM Invite: ${code}`)
    .setThumbnail(invite.channel.iconURL({ size: 4096 }))
    .setFooter({
      text: 'Source: Invite',
    })
    .addFields([
      {
        name: 'Group DM Info:',
        value: invite.channel.name ?? 'unknown group dm',
        inline: true,
      },
      {
        name: 'Members',
        value: `${OFFLINE} **${invite.memberCount.toLocaleString()}** Members`,
        // There's also a list of member usernames, display this somehow?
        inline: true,
      },
      {
        name: 'GDM Created At:',
        value: formatDate(createdAt),
      },
    ])

  if (invite.expiresAt) {
    embed.addFields([
      {
        name: 'Invite Expires At:',
        value: formatDate(invite.expiresAt),
      },
    ])
  }

  if (invite.inviter) {
    embed.addFields([{ name: 'Inviter:', value: formatUser(invite.inviter) }])

    components.addComponents([
      new ButtonBuilder()
        .setEmoji('📫')
        .setLabel('Lookup Inviter')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(`${LOOKUP_ID}:${invite.inviter.id}`),
    ])
  }

  await interaction.editReply({
    embeds: [embed],
    components: components.components.length > 0 ? [components] : [],
  })
}

/**
 * Sends all available information about a guild using the Widget API
 * @param interaction The interaction to reply to
 * @param widget The widget to pull information from
 */
async function sendGuildWidgetLookup(
  interaction: LookupInteraction,
  widget: Widget,
) {
  const created = snowflakeToDate(widget.id)
  const embed = new EmbedBuilder()
    .setTitle(`Guild: ${widget.name}`)
    .addFields([
      { name: 'ID:', value: widget.id, inline: true },
      {
        name: 'Invite:',
        value: widget.instantInvite ?? 'No invite',
        inline: true,
      },
      {
        name: 'Channels:',
        value: plural('channel', widget.channels.size),
        inline: true,
      },
      {
        name: 'Members:',
        value: `${widget.presenceCount.toLocaleString()} online`,
        inline: true,
      },
      { name: 'Guild Created At:', value: formatDate(created) },
    ])
    .setFooter({
      text: 'Source: Guild Widget',
    })

  await interaction.editReply({ embeds: [embed] })
}

/**
 * Sends all available information from a guild using the guild preview API
 * @param interaction The interaction to reply to
 * @param preview The guild preview to display info for
 */
async function sendGuildPreviewLookup(
  interaction: LookupInteraction,
  preview: GuildPreview,
) {
  const {
    approximateMemberCount: memberCount,
    approximatePresenceCount: presenceCount,
  } = preview
  const ratio = ((presenceCount / memberCount) * 100).toFixed(0)

  const embed = new EmbedBuilder()
    .setTitle(`Guild: ${preview.name}`)
    .setThumbnail(preview.iconURL({ size: 4096 }))
    .setDescription(preview.description)
    .addFields([
      { name: 'ID:', value: preview.id, inline: true },
      {
        name: 'Members:',
        value:
          `${ONLINE} **${presenceCount.toLocaleString()}** Online (${ratio}%)\n` +
          `${OFFLINE} **${memberCount.toLocaleString()}** Total`,
        inline: true,
      },
      { name: 'Guild Created At:', value: formatDate(preview.createdAt) },
    ])
    .setFooter({
      text: 'Source: Guild Preview',
    })

  if (preview.features.length > 0) {
    embed.addFields([
      {
        name: 'Features:',
        value: codeBlock(preview.features.sort().join(', ')),
      },
    ])
  }

  if (preview.emojis.size > 0) {
    embed.addFields([
      { name: 'Emojis:', value: formatPreviewEmojis(preview.emojis) },
    ])
  }

  if (preview.stickers.size > 0) {
    embed.addFields([
      {
        name: 'Stickers:',
        value: formatStickers(preview.stickers),
      },
    ])
  }

  const images: string[] = []

  if (preview.splash) {
    // biome-ignore lint/style/noNonNullAssertion: we just checked the url exists
    const splash = preview.splashURL({ size: 4096 })!
    images.push(`[Splash](${splash})`)
  }

  if (preview.discoverySplash) {
    // biome-ignore lint/style/noNonNullAssertion: we just checked the url exists
    const discoverySplash = preview.discoverySplashURL({ size: 4096 })!
    images.push(`[Discovery Splash](${discoverySplash})`)
  }

  if (images.length > 0) {
    embed.addFields([
      { name: 'Images:', value: images.join('\n'), inline: true },
    ])
  }

  await interaction.editReply({ embeds: [embed] })
}

/**
 * Format a collection of emojis into a string for display
 * @param emojis GuildPreview emojis as a Collection
 * @returns A string representation of the emojis
 */
function formatPreviewEmojis(
  emojis: Collection<string, GuildPreviewEmoji>,
): string {
  let formattedEmojis = emojis
    .first(100)
    // Bots can't use emojis from guilds they aren't in inside embeds anymore
    // This will still work if the bot is in the guild, which leaks info about the guild that isn't public
    // So we just format every emoji to :name:
    .map((e) => `:${e.name}:`)
    .join(' ')

  if (formattedEmojis.length > 1024) {
    formattedEmojis = trimToLast(formattedEmojis.substring(0, 1024), ' ')
  }

  return formattedEmojis
}

/**
 * Format a Collection of stickers into a string for display
 * @param stickers Guild stickers as a Collection
 * @returns A string representation of the stickers
 */
function formatStickers(stickers: Collection<string, Sticker>): string {
  let formattedStickers = stickers
    .first(20)
    .map((s) => `[${s.name}](${s.url})`)
    .join(', ')

  if (formattedStickers.length > 1024) {
    formattedStickers = trimToLast(formattedStickers.substring(0, 1024), ', ')
  }

  return formattedStickers
}

/**
 * Trims a string to the last occurrence of a substring
 *
 * @example
 * trimToLast('abcdefg', 'd') // 'abc'
 *
 * @param string The string to trim
 * @param substring The substring to trim at the last occurrence of
 * @returns The string, trimmed right before the last occurrence
 */
function trimToLast(string: string, substring: string): string {
  const index = string.lastIndexOf(substring)
  if (index === -1) {
    return string
  }
  return `${string.substring(0, index)}...`
}

/**
 * Parse a Discord Snowflake into a JS Date
 * @param snowflake The Snowflake to parse
 * @returns A JS Date representing the Snowflake
 */
function snowflakeToDate(snowflake: string): Date {
  return new Date(SnowflakeUtil.timestampFrom(snowflake))
}

function formatDate(date: Date): string {
  const now = Date.now()
  const then = date.getTime()
  let msTime = 0
  let relativeString = '?'

  if (now < then) {
    msTime = then - now
    relativeString = 'left'
  } else {
    msTime = now - then
    relativeString = 'ago'
  }

  return `${prettyMilliseconds(msTime)} ${relativeString} (${time(
    date,
    'R',
  )})\n${time(date, 'F')}`
}

/** A map of GuildVerificationLevel to displayable strings */
const VerificationLevelMap: Record<GuildVerificationLevel, string> = {
  [GuildVerificationLevel.None]: 'None',
  [GuildVerificationLevel.Low]: 'Low',
  [GuildVerificationLevel.Medium]: 'Medium',
  [GuildVerificationLevel.High]: 'High',
  [GuildVerificationLevel.VeryHigh]: 'Very High',
}

/** A map of GuildNSFWLevel to displayable strings */
const NSFWLevelMap: Record<GuildNSFWLevel, string> = {
  [GuildNSFWLevel.Default]: 'Default',
  [GuildNSFWLevel.Explicit]: 'Explicit',
  [GuildNSFWLevel.Safe]: 'Safe',
  [GuildNSFWLevel.AgeRestricted]: 'Age Restricted',
}

// function formatGuildFeatures(features: `${GuildFeature}`[]): APIEmbedField[] {
//   const feats = features.sort().map((f) => GuildFeaturesMap[f])
//   const half = Math.floor(feats.length / 2)

//   return [
//     {
//       name: 'Features:',
//       value: feats.slice(0, half).join('\n'),
//       inline: true,
//     },
//     {
//       name: '\u200b',
//       value: feats.slice(half).join('\n'),
//       inline: true,
//     },
//   ]
// }

// const GuildFeaturesMap: Record<`${GuildFeature}`, string> = {
//   ANIMATED_BANNER: '<:NitroBoostLvl3:749064368620306433> Animated Banner',
//   ANIMATED_ICON: '<:NitroBoostLvl1:775420929525153792> Animated Icon',
//   APPLICATION_COMMAND_PERMISSIONS_V2:
//     '<:IconLock:811926230735126558> Application Command Permissions V2',
//   AUTO_MODERATION: '<:AutoMod:1053486337174548561> Auto Moderation',
//   BANNER: '<:MessageAttachment:807680293992529921> Banner',
//   COMMUNITY: '<:IconCommunityPublic:775848533298905130> Community',
//   CREATOR_MONETIZABLE_PROVISIONAL:
//     '<:StageTicket:863856607602802688> Creator Monetizable Provisional',
//   CREATOR_STORE_PAGE: '<:StageTicket:863856607602802688> Creator Store Page',
//   DEVELOPER_SUPPORT_SERVER:
//     '<:BadgeActiveDeveloper:1040391864651628595> Developer Support Server',
//   DISCOVERABLE: '<:ServerDiscoveryIcon:749064370318999673> Discoverable',
//   FEATURABLE: '<:WumpusStar:863856607317590057> Featurable',
//   HAS_DIRECTORY_ENTRY:
//     '<:ServerSchoolHub:882897417152917525> Has Directory Entry',
//   HUB: '<:ServerSchoolHub:882897417152917525> Hub',
//   INVITE_SPLASH: '<:NitroBoostLvl1:775420929525153792> Invite Splash',
//   INVITES_DISABLED: '<:StatusDnd:714833495524114464> Invites Disabled',
//   LINKED_TO_HUB: '<:ServerSchoolHub:882897417152917525> Linked To Hub',
//   MEMBER_VERIFICATION_GATE_ENABLED:
//     '<:IconMembershipGating:780017824550092840> Member Verification Gate Enabled',
//   MONETIZATION_ENABLED:
//     '<:StageTicket:863856607602802688> Monetization Enabled',
//   MORE_STICKERS: ':MessageSticker:753338258963824801> More Stickers',
//   NEWS: '<:ChannelAnnouncements:779042577114202122> News',
//   PARTNERED: ':ServerPartnered:842194494161027100> Partnered',
//   PREVIEW_ENABLED: '<:Wumpus_Lurk:993229751114272899> Preview Enabled',
//   PRIVATE_THREADS: '<:ChannelThreadPrivate:842224739275898921> Private Threads',
//   RELAY_ENABLED: '🏃 Relay Enabled',
//   ROLE_ICONS: '<:IconRole:826477127209320534> Role Icons',
//   ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE:
//     ':StageTicket:863856607602802688> Role Subscriptions Available',
//   ROLE_SUBSCRIPTIONS_ENABLED:
//     '<:StageTicket:863856607602802688> Role Subscriptions Enabled',
//   TICKETED_EVENTS_ENABLED:
//     '<:StageTicket:863856607602802688> Ticketed Events Enabled',
//   VANITY_URL: '<:NitroBoostLvl3:749064368620306433> Vanity Url',
//   VERIFIED: '<:ServerVerifiedBlurple:973611114543841301> Verified',
//   VIP_REGIONS: '<:VCIconUnmuted:837072274766823456> VIP Regions',
//   WELCOME_SCREEN_ENABLED:
//     '<:WumpusWave:719708131990437958> Welcome Screen Enabled',
// }
