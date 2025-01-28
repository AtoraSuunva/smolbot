import type { Prisma } from '@prisma/client'
import { stringify } from 'csv-stringify'
import {
  ApplicationCommandOptionType,
  type AttachmentPayload,
  type ChatInputCommandInteraction,
  type User,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild, getRoles, getUsers } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { plural } from '../../util/format.js'

export const mark_joined = new SleetSlashSubcommand(
  {
    name: 'mark_joined',
    description:
      'Mark users as having joined the server. Filter options act as AND.',
    options: [
      {
        name: 'users',
        description:
          'The users to mark as having joined, @mention them. (Default: all users)',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'roles',
        description:
          'The roles required to be marked as having joined, @mention them. (Default: no roles required)',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'invert',
        description:
          "Invert the selection, instead mark users who DON'T match. (Default: False)",
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'remove',
        description: 'Marks users as never having joined. (Default: False)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'dry-run',
        description:
          "Don't actually mark users, just show who would be marked. (Default: False)",
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runMarkJoined,
  },
)

const CHUNK_SIZE = 5000

async function runMarkJoined(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const users = await getUsers(interaction, 'users', false)
  const roles = await getRoles(interaction, 'roles', false)
  const invert = interaction.options.getBoolean('invert', false) ?? false
  const remove = interaction.options.getBoolean('remove', false) ?? false
  const dryRun = interaction.options.getBoolean('dry-run', false) ?? false

  const defer = interaction.deferReply()

  const toEdit = new Set<User>()
  const members = await guild.members.fetch()

  if (!users || !!roles || invert) {
    const userSet = new Set(users?.map((u) => u.id) ?? [])
    const roleSet = new Set(roles?.map((r) => r.id) ?? [])

    for (const member of members.values()) {
      const userMatches =
        (!users || userSet.has(member.user.id)) &&
        (!roles || member.roles.cache.some((r) => roleSet.has(r.id)))

      if (userMatches !== invert) {
        toEdit.add(member.user)
      }
    }
  } else {
    for (const user of users) {
      toEdit.add(user)
    }
  }

  const toEditArray = Array.from(toEdit.values())
  const toEditLength = toEditArray.length

  if (toEditLength === 0) {
    await defer
    await interaction.editReply({
      content: 'No users to mark.',
    })

    return
  }

  const files: AttachmentPayload[] =
    toEditLength === 0
      ? []
      : [
          {
            name: 'marked.csv',
            attachment: stringify(
              toEditArray.map((u) => ({ username: u.username, id: u.id })),
              {
                header: true,
              },
            ),
            description: 'Users marked',
          },
        ]

  if (dryRun) {
    await defer

    await interaction.editReply({
      content: `Would mark ${plural('user', toEditLength)} as ${
        remove ? 'never having joined' : 'having joined'
      }.`,
      files,
    })

    return
  }

  if (remove) {
    await prisma.welcomeJoins.deleteMany({
      where: {
        guildID: guild.id,
        userID: {
          in: toEditArray.map((u) => u.id),
        },
      },
    })
    await defer
  } else {
    const chunkCount = Math.max(1, Math.ceil(toEditLength / CHUNK_SIZE))
    let completed = 0

    for (let chunk = 0; chunk < chunkCount; chunk += 1) {
      const chunkEnd = Math.min(toEditLength, (chunk + 1) * CHUNK_SIZE)
      const inserts: Prisma.PrismaPromise<unknown>[] = []

      for (let i = chunk * CHUNK_SIZE; i < chunkEnd; i += 1) {
        const user = toEditArray[i]

        inserts.push(
          prisma.welcomeJoins.upsert({
            where: {
              guildID_userID: {
                guildID: guild.id,
                userID: user.id,
              },
            },
            create: {
              guildID: guild.id,
              userID: user.id,
            },
            update: {},
          }),
        )
      }

      // It's possible that with many "split" transactions like this, we could end up in a weird state
      // if an error occurs, where only some members were actually added
      // but trying to do everything in a single transaction means 0 progress report (bad UX) *and* keeps
      // the transaction open for a long time (possibly bad for the database?) which can cause a timeout
      // The *worst case* of an "incomplete" transaction isn't that bad, since it just means some users
      // aren't marked as having joined and shows there's a bigger bug at play (bad!!! We should alert about this)
      await prisma.$transaction(inserts)
      completed += inserts.length

      if (chunk !== chunkCount) {
        await defer
        await interaction.editReply({
          content: `Marking ${plural(
            'user',
            toEditLength,
          )} as having joined... (${completed.toLocaleString()}/${toEditLength.toLocaleString()})`,
        })
      }
    }
  }

  await defer
  await interaction.editReply({
    content: `Marked ${plural('user', toEditLength)} as ${
      remove ? 'never having joined' : 'having joined'
    }.`,
    files,
  })
}
