import { setInterval, setTimeout } from 'node:timers/promises'
import { stringify } from 'csv-stringify'
import {
  AttachmentBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from 'discord.js'
import { type SleetContext, SleetSlashSubcommand, getGuild } from 'sleetcord'
import { MINUTE, SECOND } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import {
  fetchGuildsPendingArchive,
  fetchWarningConfigFor,
  markWarningArchiveDirty,
} from './utils.js'

export const warningsExport = new SleetSlashSubcommand(
  {
    name: 'export',
    description: 'Export all warnings for this server',
  },
  {
    run: warningsExportRun,
    ready: warningsExportReady,
  },
)

async function warningsExportRun(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const defer = interaction.deferReply()

  const archive = await csvArchiveForGuild(guild.id)

  await defer
  await interaction.editReply({
    content: 'Exported Warnings',
    files: [archive],
  })
}

const WAIT_BETWEEN_EXPORTS = 10 * SECOND // Wait 10 seconds between each guild export, to avoid being ratelimited
const WAIT_BETWEEN_CHECKS = 10 * MINUTE // Wait 10 minutes between each check for dirty guilds to export

export async function warningsExportReady(this: SleetContext) {
  await archiveAllDirtyGuilds(this.client)

  for await (const _ of setInterval(WAIT_BETWEEN_CHECKS)) {
    await archiveAllDirtyGuilds(this.client)
  }
}

async function archiveAllDirtyGuilds(client: Client) {
  const guilds = await fetchGuildsPendingArchive()

  for (const guildID of guilds) {
    const config = await fetchWarningConfigFor(guildID)

    if (!config?.archiveEnabled || !config.archiveChannel) continue

    const channel = await client.channels.fetch(config.archiveChannel)

    if (!channel?.isSendable()) continue

    const archive = await csvArchiveForGuild(guildID)

    await channel.send({
      content: 'Automated Warnings Export',
      files: [archive],
    })

    await markWarningArchiveDirty(guildID, true, false)

    await setTimeout(WAIT_BETWEEN_EXPORTS)
  }
}

async function csvArchiveForGuild(guildID: string): Promise<AttachmentBuilder> {
  const allWarnings = await prisma.warning.findMany({
    where: {
      guildID,
    },
  })

  return new AttachmentBuilder(
    stringify(allWarnings, {
      header: true,
      cast: {
        boolean: (value) => (value ? 'true' : 'false'),
        date: (value) => value.toISOString(),
      },
      escape_formulas: true, // so you can happily import into excel or whatever and not get hit by "===username==="
    }),
  ).setName('warnings.csv')
}
