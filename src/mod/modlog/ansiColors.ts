export const ESCAPE = '\u001b'
export const RESET = `${ESCAPE}[0m`
// eslint-disable-next-line no-control-regex
export const ANSI_REGEX = /\u001b.*?m/g

export enum Format {
  Normal = 0,
  Bold = 1,
  Unspecified = 2,
  Underline = 4,
}

function isFormat(value: unknown): value is Format {
  return (
    value === Format.Normal ||
    value === Format.Bold ||
    value === Format.Underline
  )
}

export enum TextColor {
  Reset = 0,
  Normal = 2,
  Gray = 30,
  Red = 31,
  Green = 32,
  Yellow = 33,
  Blue = 34,
  Pink = 35,
  Cyan = 36,
  White = 37,
}

export enum BackgroundColor {
  Reset = 0,
  Normal = 2,
  FireflyDarkBlue = 40,
  Orange = 41,
  MarbleBlue = 42,
  GreyishTurquoise = 43,
  Gray = 44,
  Indigo = 45,
  LightGray = 46,
  White = 47,
}

export type Markup =
  | [Format, TextColor | BackgroundColor]
  | Format
  | TextColor
  | BackgroundColor

export function ansiFormat(
  markup: Markup,
  text: string | number,
  reset = true,
) {
  return ansiMultiFormat([markup], text, reset)
}

export function ansiMultiFormat(
  markup: Markup[],
  text: string | number,
  reset = true,
) {
  const arrayMarkup = markup.map((m) => {
    if (Array.isArray(m)) {
      return m
    } else if (isFormat(m)) {
      return [m, TextColor.Normal]
    } else {
      return [Format.Unspecified, m]
    }
  })

  return `${ESCAPE}[${arrayMarkup.map((m) => `${m[0]};${m[1]}`).join(';')}m${text}${reset ? RESET : ''}`
}
