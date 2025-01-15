import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
} from 'discord.js'
import { SleetSlashCommand } from 'sleetcord'
import { plural } from '../util/format.js'

const MAX_OPTIONS = 200
const MAX_PICKS = 50

export const choose = new SleetSlashCommand(
  {
    name: 'choose',
    description: 'Chooses between multiple options',
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
        name: 'options',
        type: ApplicationCommandOptionType.String,
        description: `The options to choose from, use commas (,) to separate them (max: ${MAX_OPTIONS})`,
        required: true,
      },
      {
        name: 'pick_count',
        type: ApplicationCommandOptionType.Integer,
        description: `The number of options to pick (default: 1, max: ${MAX_PICKS})`,
      },
      {
        name: 'ephemeral',
        type: ApplicationCommandOptionType.Boolean,
        description: 'Only show the result to you (default: False)',
      },
    ],
  },
  {
    run: runChoose,
  },
)

const intlList = new Intl.ListFormat('en', {
  style: 'long',
  type: 'conjunction',
})

async function runChoose(interaction: ChatInputCommandInteraction) {
  const inputOptions = interaction.options.getString('options', true)
  const pickCount = interaction.options.getInteger('pick_count') ?? 1
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  if (inputOptions.length === 0) {
    await interaction.reply({
      content: "You didn't give me any options to choose from!",
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  if (pickCount <= 0) {
    await interaction.reply({
      content: "I can't pick less than 1 option!",
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const options = inputOptions
    .split(',')
    .map((option) => option.trim())
    .filter((option) => option.length > 0)

  if (options.length === 1) {
    await interaction.reply({
      content: `There's only 1 option, so **${options[0]}**!\nUse commas (,) to separate multiple options if you didn't mean to only put 1 option, like this "otter, ferret, weasel".`,
      flags: ephemeral ? MessageFlags.Ephemeral : '0',
      allowedMentions: { parse: [] },
    })
    return
  }

  if (options.length > MAX_OPTIONS) {
    await interaction.reply({
      content: `You can't give me more than ${plural(
        'option',
        MAX_OPTIONS,
      )}! You gave ${plural('option', options.length)}.`,
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  if (pickCount > MAX_PICKS) {
    await interaction.reply({
      content: `You can't pick more than ${plural('option', MAX_PICKS)}!`,
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  if (pickCount > options.length) {
    await interaction.reply({
      content: `You can't pick ${plural('option', pickCount)} from ${plural(
        'option',
        options.length,
      )}!`,
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const pickedOptions: string[] = []
  const pickedIndexes = new Set<number>()

  while (
    pickedOptions.length < pickCount &&
    pickedOptions.length < options.length
  ) {
    const i = Math.floor(Math.random() * options.length)
    if (pickedIndexes.has(i)) continue
    pickedIndexes.add(i)
    const choice = options[i]
    pickedOptions.push(choice)
  }

  const content = `I choose **${intlList.format(pickedOptions)}**!`

  if (content.length > 2000) {
    await interaction.reply({
      content: 'The result was too long, see the attached file:',
      files: [
        {
          name: 'choice.txt',
          attachment: Buffer.from(content, 'utf-8'),
        },
      ],
      flags: ephemeral ? MessageFlags.Ephemeral : '0',
    })
  } else {
    await interaction.reply({
      content,
      flags: ephemeral ? MessageFlags.Ephemeral : '0',
      allowedMentions: { parse: [] },
    })
  }
}
