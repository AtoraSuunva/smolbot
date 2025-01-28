import { ButtonBuilder, ButtonStyle } from 'discord.js'
import { SleetModule } from 'sleetcord'
import { makeAutoreplyModule } from 'sleetcord-common'

const SOURCE_URL = 'https://github.com/AtoraSuunva/smolbot/tree/development'

const buttons: ButtonBuilder[] = [
  new ButtonBuilder()
    .setLabel('More Info & Source Code')
    .setStyle(ButtonStyle.Link)
    .setURL(SOURCE_URL),
]

export const autoreply = makeAutoreplyModule({
  buttons,
})

const THANKS_REGEX = /thanks?\s*(u|you)?\s*(,\s*)?tol(bot)?/i

export const thanksAutoreply = new SleetModule(
  {
    name: 'thanks-autoreply',
  },
  {
    messageCreate: (message) => {
      if (message.author.bot) return

      if (THANKS_REGEX.test(message.content)) {
        return message.reply({
          content: 'np',
          allowedMentions: { parse: [], repliedUser: false },
        })
      }

      return
    },
  },
)
