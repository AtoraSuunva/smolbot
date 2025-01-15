import {
  type APIApplicationCommandBasicOption,
  type APIApplicationCommandOptionChoice,
  ApplicationCommandOptionType,
  Constants,
  type Guild,
} from 'discord.js'
import { makeChoices } from 'sleetcord'
import { prisma } from '../../util/db.js'

export enum AntiRaidActions {
  None = 'none',
  Kick = 'kick',
  Ban = 'ban',
  Timeout = 'timeout',
}

export const AntiRaidActionVerb = {
  [AntiRaidActions.None]: 'ignored',
  [AntiRaidActions.Kick]: 'kicked',
  [AntiRaidActions.Ban]: 'banned',
  [AntiRaidActions.Timeout]: 'timed out',
}

export const antiRaidChoices: APIApplicationCommandOptionChoice<string>[] =
  makeChoices(Object.values(AntiRaidActions))

export const antiRaidOptions: APIApplicationCommandBasicOption[] = [
  {
    name: 'action',
    description: 'The action to take when a raid is detected',
    type: ApplicationCommandOptionType.String,
    choices: antiRaidChoices,
  },
  {
    name: 'threshold',
    description:
      'The weight threshold, if the sum of every weight reaches the threshold, the user is actioned',
    type: ApplicationCommandOptionType.Number,
    min_value: 0,
  },
  {
    name: 'timeout_duration',
    description:
      'The duration for timeouts applied by antiraid, in minutes (1 min - 7 days)',
    type: ApplicationCommandOptionType.Integer,
    min_value: 1,
    max_value: 7 * 24 * 60, // 7 days max
  },
  {
    name: 'account_age_limit_min',
    description:
      'Accounts <= this age (in minutes) will incur max account age weight',
    type: ApplicationCommandOptionType.Number,
    min_value: 0,
    max_value: 7 * 24 * 60, // 7 days max
  },
  {
    name: 'account_age_limit_max',
    description:
      'Accounts between min and max age will get linearly scaling age weight (from weight -> 0)',
    type: ApplicationCommandOptionType.Number,
    min_value: 0,
    max_value: 7 * 24 * 60, // 7 days max
  },
  {
    name: 'account_age_weight',
    description:
      'The weight applied to users whose accounts are younger than the limit',
    type: ApplicationCommandOptionType.Number,
  },
  {
    name: 'no_profile_picture_weight',
    description: 'The weight applied to users without a profile picture',
    type: ApplicationCommandOptionType.Number,
  },
  {
    name: 'reason',
    description:
      'The reason for the action, add `[no-log]` to not log the action in the actionlog',
    type: ApplicationCommandOptionType.String,
  },
  {
    name: 'log_channel',
    description: 'The channel to log actions to',
    type: ApplicationCommandOptionType.Channel,
    channel_types: Constants.GuildTextBasedChannelTypes,
  },
  {
    name: 'reset',
    description:
      'Reset the antiraid config to default, applying any specified configs after',
    type: ApplicationCommandOptionType.Boolean,
  },
]

export async function getAntiRaidConfigOrDefault(
  guild: Guild,
  forceDefault = false,
) {
  if (!forceDefault) {
    const config = await prisma.antiRaidConfig.findUnique({
      where: {
        guildID: guild.id,
      },
    })

    if (config) {
      return config
    }
  }

  return prisma.antiRaidConfig.create({
    data: {
      guildID: guild.id,
      enabled: false,
      action: AntiRaidActions.None,
      threshold: 10,
      reason: null,
      logChannelID: null,
      timeoutDuration: 60,
      accountAgeLimitMin: 0,
      accountAgeLimitMax: 10,
      accountAgeWeight: 0,
      noProfilePictureWeight: 0,
    },
  })
}
