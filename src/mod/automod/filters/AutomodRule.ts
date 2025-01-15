import type { Prisma } from '@prisma/client'
import {
  type BaseValidator,
  type MappedObjectValidator,
  s,
} from '@sapphire/shapeshift'
import {
  ApplicationCommandOptionType,
  type Awaitable,
  type Message,
} from 'discord.js'
import type { SleetSlashSubcommandBody } from 'sleetcord'

export interface RuleTriggerInfo {
  readonly causedBy?: Message[]
  readonly reason: string
}

export type AutomodRuleData = Omit<
  Prisma.AutomodRuleCreateInput,
  'guildID' | 'ruleID'
>

type PrimitiveFromOptionType<T extends ApplicationCommandOptionType> =
  T extends ApplicationCommandOptionType.String
    ? string
    : T extends ApplicationCommandOptionType.Integer
      ? number
      : T extends ApplicationCommandOptionType.Boolean
        ? boolean
        : T extends ApplicationCommandOptionType.User
          ? string
          : T extends ApplicationCommandOptionType.Channel
            ? string
            : T extends ApplicationCommandOptionType.Role
              ? string
              : T extends ApplicationCommandOptionType.Mentionable
                ? string
                : never

function createParameterPackerFrom(
  options: SleetSlashSubcommandBody['options'],
) {
  if (options === undefined) {
    return undefined
  }

  return s.object(
    options.reduce<MappedObjectValidator<unknown>>((acc, option) => {
      return {
        // biome-ignore lint/performance/noAccumulatingSpread: TODO: this is still WIP
        ...acc,
        [option.name]: validatorFromType(option.type),
      }
    }, {}),
  )
}

function validatorFromType(
  type: ApplicationCommandOptionType,
): BaseValidator<PrimitiveFromOptionType<ApplicationCommandOptionType>> {
  switch (type) {
    case ApplicationCommandOptionType.String:
      return s.string()

    case ApplicationCommandOptionType.Number:
    case ApplicationCommandOptionType.Integer:
      return s.number()

    case ApplicationCommandOptionType.Boolean:
      return s.boolean()

    case ApplicationCommandOptionType.User:
    case ApplicationCommandOptionType.Channel:
    case ApplicationCommandOptionType.Role:
    case ApplicationCommandOptionType.Mentionable:
      return s.string()

    default:
      throw new Error(`Invalid option type for automod: ${type}`)
  }
}

export abstract class AutomodRule<P extends unknown[] = []> {
  public readonly body: SleetSlashSubcommandBody
  public readonly description: string
  public readonly message: string
  public readonly action: string
  public readonly delete: boolean

  private parameterUnpacker

  /**
   * Create a new automod rule
   * @param message The message to display in chat when someone triggers the rule
   */
  constructor(body: SleetSlashSubcommandBody, data: AutomodRuleData) {
    this.body = body
    this.description = data.description
    this.message = data.message
    this.action = data.action
    this.delete = data.delete

    this.parameterUnpacker = createParameterPackerFrom(this.body.options)
  }

  unpackParameters(params: string): P {
    if (this.parameterUnpacker === undefined) {
      return undefined as unknown as P
    }

    return this.parameterUnpacker.parse(JSON.parse(params)) as unknown as P
  }

  packParameters(): P {
    return [] as unknown[] as P
  }

  /**
   * Stringify the parameters to this rule so that they can be stored in the database
   * @returns A stringified version of the parameters that can be stored in the database
   */
  stringifyParameters(): string {
    return JSON.stringify(this.packParameters())
  }

  /**
   * Serialize this rule into a format that can be stored in a database
   */
  toDatabase(): AutomodRuleData {
    return {
      type: this.body.name,
      description: this.description,
      message: this.message,
      action: this.action,
      delete: this.delete,
      parameters: this.stringifyParameters(),
    }
  }

  filterMessage(_message: Message<true>): Awaitable<RuleTriggerInfo | null> {
    return null
  }
}
