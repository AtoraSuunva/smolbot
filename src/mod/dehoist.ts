import type { Prisma } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  type GuildMember,
  InteractionContextType,
  type PartialGuildMember,
} from 'discord.js'
import {
  SleetSlashCommand,
  botHasPermissionsGuard,
  getGuild,
  getMembers,
} from 'sleetcord'
import { prisma } from '../util/db.js'
import { plural } from '../util/format.js'

const DEFAULT_PREPEND = '\u{17B5}' // Khmer Vowel Inherent Aa "◌឵"

export const dehoist = new SleetSlashCommand(
  {
    name: 'dehoist',
    description:
      'Dehoists users by placing an invisible character in front of their name',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    default_member_permissions: ['ManageNicknames'],
    options: [
      {
        name: 'members',
        description:
          'The members to dehoist, regardless if their display name matches the hoist characters or not',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'hoist_characters',
        description:
          'Dehoist the user if a display name starts with one of these characters (default: "!")',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'dehoist_prepend',
        description:
          "Characters to add in front of a user's name to dehoist them (default: `U+17B5`)",
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'automatic',
        description:
          'Automatically dehoist on join, username/nickname change using the provided options (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runDehoist,
    async guildMemberAdd(member) {
      await checkToDehoist([member])
    },
    async guildMemberUpdate(_, newMember) {
      await checkToDehoist([newMember])
    },
    async guildMemberAvailable(member) {
      await checkToDehoist([member])
    },
  },
)

type DehoistableMember = GuildMember | PartialGuildMember

interface DehoistSettings {
  hoistCharacters: string[]
  dehoistPrepend: string
  force?: boolean
}

interface DehoistResult {
  member: DehoistableMember
  dehoisted: boolean
  skipped: boolean
}

interface DehoistBatchResult {
  dehoisted: number
  failed: number
}

async function runDehoist(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  await botHasPermissionsGuard(interaction, ['ManageNicknames'])

  const hoistCharacters = (
    interaction.options.getString('hoist_characters') ?? '!'
  ).split('')
  const dehoistPrepend =
    interaction.options.getString('dehoist_prepend') ?? DEFAULT_PREPEND
  const automatic = interaction.options.getBoolean('automatic')

  await interaction.deferReply()

  const members = interaction.options.getString('members')
    ? await getMembers(interaction, 'members', true)
    : await guild.members
        .fetch()
        .then((members) =>
          members
            .filter(
              (m) =>
                !m.user.bot &&
                m.manageable &&
                m.permissions.has('ManageNicknames') &&
                hoistCharacters.includes(m.displayName[0]),
            )
            .toJSON(),
        )

  if (members.length === 0) {
    await interaction.editReply('Found no matching members to dehoist!')
    return
  }

  const found = `Found ${plural('member', members.length)} to dehoist, dehoisting...`

  await interaction.editReply(found)

  const generator = dehoistMembers(members, {
    hoistCharacters,
    dehoistPrepend,
    force: true,
  })

  let dehoisted = 0
  let failed = 0
  let skipped = 0

  for await (const result of generator) {
    if (result.dehoisted) {
      dehoisted++
    } else if (!result.skipped) {
      failed++
    } else {
      skipped++
    }

    const checked = dehoisted + failed + skipped

    if (checked % 10 === 0) {
      await interaction.editReply(
        `${found} (${dehoisted} dehoisted, ${checked}/${members.length} done)`,
      )
    }
  }

  if (automatic !== null) {
    const update: Prisma.AutomaticDehoistUpdateInput = {
      guildID: guild.id,
      enabled: automatic,
    }

    const hc = interaction.options.getString('hoist_characters')
    if (hc) {
      update.hoistCharacters = hc
    }

    const dp = interaction.options.getString('dehoist_prepend')
    if (dp) {
      update.dehoistPrepend = dp
    }

    await prisma.automaticDehoist.upsert({
      where: { guildID: guild.id },
      create: {
        guildID: guild.id,
        enabled: automatic,
        dehoistPrepend,
        hoistCharacters: hoistCharacters.join(''),
      },
      update,
    })
  }

  await interaction.editReply(
    `Dehoisted ${plural('member', dehoisted)}!${failed > 0 ? `\nFailed to dehoist ${plural('member', failed)}.` : ''}${skipped > 0 ? `\nSkipped ${plural('member', skipped)}.` : ''}`,
  )
}

async function checkToDehoist(members: DehoistableMember[]) {
  const [firstMember] = members

  if (
    !firstMember ||
    !(await firstMember.guild.members
      .fetchMe()
      .then((me) => me.permissions.has('ManageNicknames')))
  ) {
    return
  }

  const dehoistable = members.filter(
    (m) => !m.user.bot && m.permissions.has('ManageNicknames') && m.manageable,
  )

  if (dehoistable.length === 0) return

  const guild = dehoistable[0].guild
  const settings = await prisma.automaticDehoist.findUnique({
    where: { guildID: guild.id },
  })

  if (!settings?.enabled) return

  const hoistCharacters = settings.hoistCharacters.split('')

  const generator = dehoistMembers(dehoistable, {
    hoistCharacters,
    dehoistPrepend: settings.dehoistPrepend,
  })

  for await (const _ of generator) {
    // skip
  }
}

async function* dehoistMembers(
  members: DehoistableMember[],
  settings: DehoistSettings = {
    hoistCharacters: ['!'],
    dehoistPrepend: DEFAULT_PREPEND,
    force: false,
  },
): AsyncGenerator<DehoistResult, DehoistBatchResult, void> {
  const { hoistCharacters, dehoistPrepend, force } = settings

  let dehoisted = 0
  let failed = 0

  for (const member of members) {
    if (!force && !hoistCharacters.includes(member.displayName[0])) {
      yield { member, dehoisted: false, skipped: true }
      continue
    }

    if (!member.manageable) {
      failed++
      yield { member, dehoisted: false, skipped: false }
      continue
    }

    try {
      const newNick = (dehoistPrepend + member.displayName).substring(0, 32)

      if (newNick === member.displayName) {
        yield { member, dehoisted: false, skipped: true }
        continue
      }

      await member.setNickname(newNick, 'Dehoist')
      dehoisted++
      yield { member, dehoisted: true, skipped: false }
    } catch {
      failed++
      yield { member, dehoisted: false, skipped: false }
    }
  }

  return { dehoisted, failed }
}
