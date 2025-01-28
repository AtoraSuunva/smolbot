import { setTimeout } from 'node:timers/promises'
import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  type Collection,
  type GuildMember,
  InteractionContextType,
} from 'discord.js'
import {
  SleetSlashCommand,
  escapeAllMarkdown,
  getGuild,
  makeChoices,
} from 'sleetcord'
import { SECOND } from 'sleetcord-common'
import { plural } from '../util/format.js'

const checkChoices = makeChoices([
  'username',
  'nickname',
  'global name',
  'display name',
  'any name',
])
type CheckChoice = (typeof checkChoices)[number]['value']

const intlList = new Intl.ListFormat('en', {
  style: 'long',
  type: 'disjunction',
})

export const count_members = new SleetSlashCommand(
  {
    name: 'count_members',
    description: 'Counts the number of members in a guild',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [
      {
        name: 'name_contains',
        description: "Count members who's name contains this string",
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'name_equals',
        description: "Count members who's name is this exact string",
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'only_check',
        description:
          "Only check this part of a user's name (default: any name)",
        type: ApplicationCommandOptionType.String,
        choices: checkChoices,
      },
      {
        name: 'case_sensitive',
        description:
          'Whether to check the name case sensitively (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runCountMembers,
  },
)

async function runCountMembers(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const nameContains = interaction.options.getString('name_contains')
  const nameEquals = interaction.options.getString('name_equals')
  const onlyCheck: CheckChoice =
    (interaction.options.getString('only_check') as CheckChoice | null) ??
    'any name'
  const caseSensitive =
    interaction.options.getBoolean('case_sensitive') ?? false

  // No filtering required
  if (!nameContains && !nameEquals) {
    const count = guild.memberCount
    return interaction.reply(
      `There ${plural('is', count, { includeCount: false })} ${plural(
        'member',
        count,
      )} in this guild.`,
    )
  }

  await interaction.deferReply()

  const members = await Promise.race([
    setTimeout(10 * SECOND),
    guild.members.fetch(),
  ])

  if (!members) {
    return interaction.editReply(
      'Timed out while trying to fetch members, try again later.',
    )
  }

  let count = 0
  const checks: string[] = []
  const getName = getMemberNameForCheckChoice(onlyCheck)
  const choiceDisplay = displayChoice(onlyCheck)
  const sensitivity = caseSensitive ? '' : ' (case insensitive)'

  if (nameContains) {
    const toCheck = caseSensitive ? nameContains : nameContains.toLowerCase()
    count += countMembersMatching(members, getName, caseSensitive, (name) =>
      name.includes(toCheck),
    )
    checks.push(
      `**"${escapeAllMarkdown(
        nameContains,
      )}"**${sensitivity} in their ${choiceDisplay}`,
    )
  }

  if (nameEquals) {
    const toCheck = caseSensitive ? nameEquals : nameEquals.toLowerCase()
    count += countMembersMatching(
      members,
      getName,
      caseSensitive,
      (name) => name === toCheck,
    )
    checks.push(
      `**"${escapeAllMarkdown(
        nameEquals,
      )}"**${sensitivity} as their ${choiceDisplay}`,
    )
  }

  return interaction.editReply({
    content: `${plural('member', count)} ${plural('has', count, {
      includeCount: false,
    })} ${intlList.format(checks)}.`,
    allowedMentions: { parse: [] },
  })
}

type MemberNameGetter = (member: GuildMember) => string[]
type MemberNameFilter = (memberName: string) => boolean

function countMembersMatching(
  members: Collection<string, GuildMember>,
  getName: MemberNameGetter,
  caseSensitive: boolean,
  filter: MemberNameFilter,
): number {
  return members.filter((m) =>
    getName(m).some((name) =>
      filter(caseSensitive ? name : name.toLowerCase()),
    ),
  ).size
}

function getMemberNameForCheckChoice(choice: CheckChoice): MemberNameGetter {
  switch (choice) {
    case 'username':
      return (member) => [member.user.username]

    case 'nickname':
      return (member) => (member.nickname ? [member.nickname] : [])

    case 'display name':
      return (member) => [member.user.displayName]

    case 'global name':
      return (member) =>
        member.user.globalName ? [member.user.globalName] : []

    case 'any name':
      return (member) => [
        ...(member.nickname ? [member.nickname] : []),
        ...(member.user.globalName ? [member.user.globalName] : []),
        member.user.username,
      ]
  }
}

function displayChoice(choice: CheckChoice): string {
  switch (choice) {
    case 'any name':
      return 'nickname, global name, or username'

    default:
      return choice
  }
}
