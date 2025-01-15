import { Readable } from 'node:stream'
import type { Prisma, PrismaPromise, Warning } from '@prisma/client'
import {
  BaseError,
  type BaseErrorJsonified,
  CombinedError,
  CombinedPropertyError,
  type ObjectValidator,
  Result,
  s,
} from '@sapphire/shapeshift'
import { parse } from 'csv-parse'
import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  codeBlock,
} from 'discord.js'
import { SleetSlashCommand, getGuild } from 'sleetcord'
import { baseLogger } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { plural } from '../../util/format.js'

const importWarningsLogger = baseLogger.child({ module: 'import_warnings' })

// Separate command since this is potentially abusive, someone could import a LOT of garbage data or falsify new warnings with other mods as responsible
export const importWarnings = new SleetSlashCommand(
  {
    name: 'import_warnings',
    description:
      'Import warnings from a CSV file. Can only create NEW warnings',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    default_member_permissions: ['ManageGuild'],
    options: [
      {
        name: 'file',
        description: 'The CSV file to import',
        type: ApplicationCommandOptionType.Attachment,
        required: true,
      },
    ],
  },
  {
    run: warningsImportRun,
  },
)

async function warningsImportRun(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const file = interaction.options.getAttachment('file', true)

  if (file.contentType?.split(';')[0]?.trim() !== 'text/csv') {
    await interaction.reply('Expected a .csv file')
    return
  }

  const defer = interaction.deferReply()

  const response = await fetch(file.url)

  if (!response.body || !response.ok) {
    await defer
    await interaction.editReply('Failed to fetch file')
    return
  }

  const parser = parse({
    columns: true,
    trim: true,
    cast: (value, context): Warning[keyof Warning] => {
      if (context.header) return value

      switch (context.column as keyof Warning) {
        case 'guildID':
          return guild.id // No matter the input guild, it's ALWAYS the guild the interaction was called from

        case 'moderatorID':
        case 'modNote':
        case 'validUntil':
          // Map these as nullable here, then we use the validator to do more advanced checking later
          return value === '' ? null : value

        default:
          return value
      }
    },
  })

  const parseStream = Readable.fromWeb(response.body).pipe(parser)

  const creates: PrismaPromise<unknown>[] = []
  let count = 0

  for await (const record of parseStream) {
    const validated = warningCreateValidator.run(record)

    if (validated.isErr()) {
      importWarningsLogger.error(
        validated.error,
        'Invalid warning record %o',
        record,
      )
      await defer
      await interaction.editReply(
        `You have an invalid row in your csv:\n${codeBlock(
          'js',
          JSON.stringify(formatBaseError(validated.error), null, 2),
        )}\nat:\n${codeBlock('js', JSON.stringify(record, null, 2))}`,
      )
      return
    }

    if (validated.isOk()) {
      if (validated.value.guildID !== guild.id) {
        // This *SHOULDN'T* happen, but just in case because this would be REALLY bad
        await defer
        await interaction.editReply(
          `You have an invalid row in your csv:\n${codeBlock(
            'js',
            'guildID must be the same as the guild the command was called in',
          )}\nat:\n${codeBlock('js', JSON.stringify(record, null, 2))}`,
        )
        return
      }

      creates.push(
        prisma.warning.create({
          data: validated.value,
        }),
      )
      count++
    }
  }

  await prisma.$transaction(creates)
  await defer
  await interaction.editReply(`Imported ${plural('warning', count)}`)
}

const warningCreateValidator: ObjectValidator<Prisma.WarningCreateInput> = s
  .object({
    guildID: s.string().regex(/^\d{1,20}$/), // Probably more than long enough for a snowflake
    warningID: s.string().reshape(reshapeToNumber),
    version: s.string().reshape(reshapeToNumber),
    user: s.string().lengthLessThanOrEqual(100), // 2-32 username + #discrim (5) = 37 but JS doesn't count astral symbols correctly, discord does
    userID: s.string().regex(/^\d{1,20}$/),
    reason: s.string().lengthLessThan(256),
    permanent: s.string().reshape(reshapeToBoolean),
    void: s.string().reshape(reshapeToBoolean),
    moderatorID: s
      .string()
      .regex(/^\d{1,20}$/)
      .nullable(),
    modNote: s.string().lengthLessThan(256).nullable(),
    createdAt: s.string().reshape(reshapeToDate),
    validUntil: s.string().reshape(reshapeToDate).nullable(),
  })
  .strict()

function reshapeToNumber(value: string): Result<number> {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    return Result.err(new Error(`Invalid number: ${value}`))
  }

  return Result.ok(parsed)
}

function reshapeToBoolean(value: string): Result<boolean> {
  switch (value.toLowerCase()) {
    case 'true':
      return Result.ok(true)
    case 'false':
      return Result.ok(false)
    default:
      return Result.err(new Error(`Invalid boolean: ${value}`))
  }
}

function reshapeToDate(value: string): Result<Date> {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return Result.err(new Error(`Invalid date: ${value}`))
  }

  return Result.ok(parsed)
}

type FormattedBaseError = NestedError | BaseErrorJsonified

interface NestedError {
  errors: (FormattedBaseError | NestedPropertyError)[]
}

interface NestedPropertyError {
  property: PropertyKey
  errors: FormattedBaseError
}

function formatBaseError(error: BaseError): FormattedBaseError {
  if (
    error instanceof CombinedError ||
    error instanceof CombinedPropertyError
  ) {
    return {
      errors: error.errors.map((v) => {
        if (v instanceof BaseError) {
          return formatBaseError(v)
        }

        return {
          property: v[0],
          errors: formatBaseError(v[1]),
        }
      }),
    }
  }

  return error.toJSON()
}
