import type { Prisma } from '@prisma/client'
import {
  ChannelType,
  type Client,
  GatewayIntentBits,
  Partials,
} from 'discord.js'
import env from 'env-var'
import { SleetClient, SleetModule } from 'sleetcord'
import { baseLogger } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import '../../util/dbLogging.js'

const migrate_modlog = new SleetModule(
  {
    name: 'migrate_modlog',
  },
  {
    ready: runMigrateModlog,
  },
)

const logger = baseLogger.child({ module: 'migrate-modlog' })

const TOKEN = env.get('TOKEN').required().asString()
const APPLICATION_ID = env.get('APPLICATION_ID').required().asString()

const sleetClient = new SleetClient({
  sleet: {
    token: TOKEN,
    applicationId: APPLICATION_ID,
  },
  client: {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildModeration, // For Audit Log Events
    ],
    partials: [
      Partials.User,
      Partials.GuildMember,
      Partials.Reaction,
      Partials.Message,
      Partials.Channel,
    ],
  },
})

sleetClient.addModules([migrate_modlog])
await sleetClient.login()

const prefix = '>'
const modlogSentinel = `${prefix}modlog`
const settingsTemplate = [
  {
    name: 'member_add',
    create: 'memberAdd',
    init: false,
  },
  {
    name: 'member_add_new',
    create: 'memberAddNew',
    init: 48,
  },
  {
    name: 'member_add_invite',
    create: 'memberAddInvite',
    init: false,
  },
  {
    name: 'member_welcome',
    create: 'memberWelcome',
    init: false,
  },
  {
    name: 'member_remove',
    create: 'memberRemove',
    init: false,
  },
  {
    name: 'member_remove_roles',
    create: 'memberRemoveRoles',
    init: false,
  },
  {
    name: 'user_ban',
    create: 'memberBan',
    init: false,
  },
  {
    name: 'user_unban',
    create: 'memberUnban',
    init: false,
  },
  {
    name: 'user_update',
    create: 'userUpdate',
    init: 'none',
  },
  {
    name: 'delete_bulk',
    create: 'messageDeleteBulk',
    init: false,
  },
  {
    name: 'message_delete',
    create: 'messageDelete',
    init: false,
  },
  {
    name: 'channel_create',
    create: 'channelCreate',
    init: false,
  },
  {
    name: 'channel_delete',
    create: 'channelDelete',
    init: false,
  },
  {
    name: 'reaction_actions',
    create: 'reactionActions',
    init: false,
  },
  {
    name: 'automod_action',
    create: 'automodAction',
    init: false,
  },
] satisfies {
  name: string
  create: keyof Prisma.ModLogConfigCreateInput
  init: string | number | boolean
}[]

async function runMigrateModlog(client: Client) {
  let lastGuildId = 0n

  while (true) {
    const oauthGuilds = await client.guilds.fetch({
      after: lastGuildId.toString(),
    })

    const guildCount = oauthGuilds.size
    let doneGuilds = 0

    for (const oauthGuild of oauthGuilds.values()) {
      doneGuilds++
      logger.info(
        `(${doneGuilds}/${guildCount}) Checking ${oauthGuild.name} (${oauthGuild.id})`,
      )

      const guild =
        client.guilds.cache.get(oauthGuild.id) ?? (await oauthGuild.fetch())
      const channels = await guild.channels.fetch()

      for (const channel of channels.values()) {
        if (
          !channel ||
          channel.type === ChannelType.GuildCategory ||
          !channel.isTextBased() ||
          channel.isVoiceBased() ||
          !channel.topic ||
          channel.topic === ''
        ) {
          continue
        }

        const lowerTopic = channel.topic.toLowerCase()
        const lines = lowerTopic.split('\n')

        if (!lines.includes(modlogSentinel)) {
          continue
        }

        logger.info(
          `Migrating modlog settings for ${oauthGuild.name} (${oauthGuild.id}) from ${channel.name} (${channel.id})`,
        )
        const settings = parseFromTopic(lines)

        logger.info(`Settings: ${JSON.stringify(settings)}`)

        const upsert: Prisma.ModLogConfigCreateInput = {
          guildID: oauthGuild.id,
          channelID: channel.id,
          enabled: true,
          ...settings,
        }

        await prisma.modLogConfig.upsert({
          where: { guildID: oauthGuild.id },
          create: upsert,
          update: upsert,
        })

        logger.info(`Migration for ${oauthGuild.id} completed successfully`)

        const id = BigInt(oauthGuild.id)

        if (id > lastGuildId) {
          lastGuildId = id
        }

        break
      }
    }

    if (guildCount < 200) {
      break
    }
  }

  logger.info('Done!')
  process.exit(0)
}

type ModlogParse = Required<
  Omit<
    Prisma.ModLogConfigCreateInput,
    'guildID' | 'channelID' | 'updatedAt' | 'enabled'
  >
>

function parseFromTopic(topic: string[]): ModlogParse {
  const settings = settingsTemplate.map((setting) => {
    const line = topic.find((line) => line.startsWith(prefix + setting.name))

    const defaultSetting = [setting.create, setting.init]

    if (!line) {
      return defaultSetting
    }

    const equals = line.indexOf('=')

    if (equals < 0) {
      return defaultSetting
    }

    const value = toPrimitive(line.substring(equals + 1))

    if (typeof value !== typeof setting.init) {
      return defaultSetting
    }

    return [setting.create, value]
  })

  return Object.fromEntries(settings) as ModlogParse
}

function toPrimitive(val: unknown): number | boolean | null | string {
  try {
    return JSON.parse(val as string) as string
  } catch {
    return val as string
  }
}
