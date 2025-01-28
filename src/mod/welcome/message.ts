import {
  type ChatInputCommandInteraction,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
  MessageFlags,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'

export const message = new SleetSlashSubcommand(
  {
    name: 'message',
    description: 'Get details about welcome messages',
  },
  {
    run: runMessage,
  },
)

const supported = [
  ['{@user}', 'Mentions the welcomed user'],
  [
    '{#origin-channel}',
    'Mentions the channel where the user posted their first message',
  ],
  [
    '{#welcome-channel}',
    'Mentions the channel where the welcome message is posted',
  ],
  ['{message-link}', "Replaced with the link to the user's first message"],
  ['{server-name}', 'Replaced with the server name'],
]
  .map(([key, value]) => `  \`${key}\` - ${value}`)
  .join('\n')

const messageInfo = `There is (some) support for dynamic welcome message content:\n${supported}`

function runMessage(interaction: ChatInputCommandInteraction) {
  return interaction.reply({
    content: messageInfo,
    flags: MessageFlags.Ephemeral,
  })
}

interface WelcomeContext {
  member: GuildMember
  origin?: GuildTextBasedChannel | undefined
  welcome: GuildTextBasedChannel
  message?: Message | undefined
}

export function formatMessage(
  welcomeMessage: string,
  { member, origin, welcome, message }: WelcomeContext,
) {
  return welcomeMessage
    .replaceAll('{@user}', member.toString())
    .replaceAll('{#origin-channel}', origin?.toString() ?? '')
    .replaceAll('{#welcome-channel}', welcome.toString())
    .replaceAll('{message-link}', message?.url ?? '')
    .replaceAll('{server-name}', member.guild.name)
}
