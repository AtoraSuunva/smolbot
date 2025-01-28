import { char_info } from './char_info.js'
import { convert } from './convert.js'
import { count_members } from './count_members.js'
import { extract } from './extract.js'
import { manage_quote } from './quote/manage_quote.js'
import { quote } from './quote/quote.js'
import { restore_embeds } from './restore_embeds.js'
import { role_buttons } from './role_buttons.js'
import { snowflake } from './snowflake.js'
import { time_since } from './time_since.js'
import { timestamp } from './timestamp.js'
import { translateMessage, translateSlash } from './translate.js'

export const utilityModules = [
  char_info,
  convert,
  count_members,
  extract,
  manage_quote,
  quote,
  restore_embeds,
  role_buttons,
  snowflake,
  time_since,
  timestamp,
  translateMessage,
  translateSlash,
]
