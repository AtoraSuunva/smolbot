import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
} from 'discord.js'
import { SleetSlashCommand } from 'sleetcord'
import { plural } from '../util/format.js'

export const flip = new SleetSlashCommand(
  {
    name: 'flip',
    description: 'Flips a coin, or multiple coins',
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
        name: 'count',
        type: ApplicationCommandOptionType.Integer,
        description: 'The number of coins to flip (default: 1)',
      },
      {
        name: 'ephemeral',
        type: ApplicationCommandOptionType.Boolean,
        description: 'Only show the result to you (default: False)',
      },
    ],
  },
  {
    run: runFlip,
  },
)

const MAX_COINS = 50
const HEAD = '🅗'
const TAIL = 'Ⓣ'

async function runFlip(interaction: ChatInputCommandInteraction) {
  const count = interaction.options.getInteger('count') ?? 1
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  if (count <= 0) {
    await interaction.reply({
      content: "I can't flip less than 1 coin!",
      flags: ephemeral ? MessageFlags.Ephemeral : '0',
    })
    return
  }

  if (count > MAX_COINS) {
    await interaction.reply({
      content: `I can't flip more than ${plural('coin', MAX_COINS)} at once!`,
      flags: ephemeral ? MessageFlags.Ephemeral : '0',
    })
    return
  }

  const results = []
  let headCount = 0
  let tailCount = 0

  for (let i = 0; i < count; i++) {
    const result = Math.random() < 0.5 ? HEAD : TAIL

    if (result === HEAD) {
      headCount++
    } else {
      tailCount++
    }

    results.push(result)
  }

  if (count === 1) {
    const coin = results[0]
    const result = coin === HEAD ? 'heads' : 'tails'
    await interaction.reply({
      content: `I flipped a coin and got ${result} ${coin}!`,
      flags: ephemeral ? MessageFlags.Ephemeral : '0',
    })
  } else {
    await interaction.reply({
      content: `I flipped ${plural('coin', count)} and got ${plural(
        'head',
        headCount,
      )} and ${plural('tail', tailCount)}!\n${results.join(', ')}`,
      flags: ephemeral ? MessageFlags.Ephemeral : '0',
    })
  }
}
