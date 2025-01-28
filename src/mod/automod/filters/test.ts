import { ApplicationCommandOptionType } from 'discord.js'

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

type Callback<Item> = Item extends { name: infer Name; type: infer Type }
  ? Name extends PropertyKey
    ? Type extends ApplicationCommandOptionType
      ? Record<Name, PrimitiveFromOptionType<Type>>
      : never
    : never
  : never

type Reducer<T extends unknown[], Acc = object> = T extends []
  ? Acc
  : T extends [infer Head, ...infer Tail]
    ? Reducer<Tail, Acc & Callback<Head>>
    : never

const getOutput = <
  Type extends ApplicationCommandOptionType,
  Name extends string,
  Item extends { name: Name; type: Type },
  Input extends Item[],
>(
  input: Readonly<[...Input]>,
) =>
  input.reduce<Reducer<Input>>(
    // biome-ignore lint/performance/noAccumulatingSpread: TODO: this is still WIP
    (output, record) => ({ ...output, [record.name]: record.type }),
    {} as Reducer<Input>,
  )

const foo = [
  {
    name: 'max-repeats',
    description: 'The maximum number of repeats allowed',
    type: ApplicationCommandOptionType.Integer,
    required: true,
    min_value: 2,
    max_value: 100,
  },
  {
    name: 'min-repeats',
    description: 'The min number of repeats allowed',
    type: ApplicationCommandOptionType.Integer,
    required: true,
  },
  {
    name: 'cooldown',
    description: 'The cooldown between each repeat',
    type: ApplicationCommandOptionType.Integer,
  },
  {
    name: 'strict',
    description: 'Whether or not to be strict',
    type: ApplicationCommandOptionType.Boolean,
  },
] as const

const a = getOutput(foo)
console.log(a)

// -----------------------------------------------------------------------------------------------

// type ApplicationCommandOptionData = SleetSlashCommandBody['options']

// interface ApplicationCommandOptionChoiceData<T extends string | number> {
//   name: string
//   value: T
// }

// export type ExtractArrayType<T> = ((a: T) => never) extends (
//   a: (infer H)[],
// ) => never
//   ? H
//   : never

// export type MaybePromise<T> = T | Promise<T>

// type LengthOfReadonly<T extends Readonly<unknown[]>> = T['length']
// type HeadOfReadonly<T extends Readonly<unknown[]>> = T extends [] ? never : T[0]
// type TailOfReadonly<T extends Readonly<unknown[]>> = ((
//   ...array: T
// ) => never) extends (head: never, ...tail: infer Tail_) => never
//   ? Tail_
//   : never

// type MapChoicesToValues<
//   T extends readonly ApplicationCommandOptionChoiceData[],
// > = {
//   [K in keyof T]: T[K] extends ApplicationCommandOptionChoiceData
//     ? T[K]['value']
//     : never
// }[number]

// type HasChoices = {
//   choices: readonly [
//     ApplicationCommandOptionChoiceData,
//     ...ApplicationCommandOptionChoiceData[],
//   ]
// }

// type CommandInteractionOptionResolverReturn<
//   T extends keyof CommandInteractionOptionResolver,
// > = CommandInteractionOptionResolver[T] extends Function
//   ? // @ts-expect-error this works, it just doesn't narrow the type here
//     NonNullable<ReturnType<CommandInteractionOptionResolver[T]>>
//   : never

// export type OptionsMap = {
//   STRING: CommandInteractionOptionResolverReturn<'getString'>
//   3: CommandInteractionOptionResolverReturn<'getString'>
//   INTEGER: CommandInteractionOptionResolverReturn<'getInteger'>
//   4: CommandInteractionOptionResolverReturn<'getInteger'>
//   BOOLEAN: CommandInteractionOptionResolverReturn<'getBoolean'>
//   5: CommandInteractionOptionResolverReturn<'getBoolean'>
//   USER:
//     | CommandInteractionOptionResolverReturn<'getMember'>
//     | CommandInteractionOptionResolverReturn<'getUser'>
//   6:
//     | CommandInteractionOptionResolverReturn<'getMember'>
//     | CommandInteractionOptionResolverReturn<'getUser'>
//   CHANNEL: CommandInteractionOptionResolverReturn<'getChannel'>
//   7: CommandInteractionOptionResolverReturn<'getChannel'>
//   ROLE: CommandInteractionOptionResolverReturn<'getRole'>
//   8: CommandInteractionOptionResolverReturn<'getRole'>
//   MENTIONABLE:
//     | CommandInteractionOptionResolverReturn<'getMember'>
//     | CommandInteractionOptionResolverReturn<'getRole'>
//     | CommandInteractionOptionResolverReturn<'getUser'>
//   9:
//     | CommandInteractionOptionResolverReturn<'getMember'>
//     | CommandInteractionOptionResolverReturn<'getRole'>
//     | CommandInteractionOptionResolverReturn<'getUser'>
//   NUMBER: CommandInteractionOptionResolverReturn<'getInteger'>
//   10: CommandInteractionOptionResolverReturn<'getInteger'>
//   ATTACHMENT: CommandInteractionOptionResolverReturn<'getAttachment'>
//   11: CommandInteractionOptionResolverReturn<'getAttachment'>
// }

// type ChannelsMap = {
//   0: TextChannel
//   1: never // DM
//   2: VoiceChannel
//   3: never // Group DM
//   4: CategoryChannel
//   5: NewsChannel
//   10: ThreadChannel
//   11: ThreadChannel
//   12: ThreadChannel
//   13: StageChannel
//   14: never // Directory
//   15: ForumChannel // Forum
// }

// type MapChannelTypesToChannels<T extends ReadonlyArray<ChannelType>> = {
//   [K in keyof T]: T[K] extends ChannelType ? ChannelsMap[T[K]] : never
// }[number]

// type OptionToValue<T extends ApplicationCommandOptionData> = T extends {
//   transformer: (value: any) => unknown
// }
//   ? Awaited<ReturnType<T['transformer']>>
//   : T extends HasChoices
//   ? MapChoicesToValues<T['choices']>
//   : T extends {
//       channelTypes: ReadonlyArray<ChannelType>
//     }
//   ?
//       | MapChannelTypesToChannels<T['channelTypes']>
//       | APIInteractionDataResolvedChannel
//   : OptionsMap[T['type']]

// export type CommandOptionsObject<T extends OptionsDataArray> = {
//   [Key in T[number]['name']]: Extract<
//     T[number],
//     { name: Key }
//   >['required'] extends true
//     ? OptionToValue<Extract<T[number], { name: Key }>>
//     : OptionToValue<Extract<T[number], { name: Key }>> | null
// }

// type MapOptionToAutocompleteName<T extends ApplicationCommandOptionData> =
//   T extends { autocomplete: true }
//     ? T extends {
//         onAutocomplete: Function
//       }
//       ? never
//       : T['name']
//     : never

// export type MapOptionsToAutocompleteNames<
//   T extends readonly ApplicationCommandOptionData[],
// > = LengthOfReadonly<T> extends 0
//   ? never
//   : LengthOfReadonly<T> extends 1
//   ? MapOptionToAutocompleteName<HeadOfReadonly<T>>
//   :
//       | MapOptionToAutocompleteName<HeadOfReadonly<T>>
//       | MapOptionsToAutocompleteNames<TailOfReadonly<T>>
