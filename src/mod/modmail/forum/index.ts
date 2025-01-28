import { SleetSlashCommandGroup } from 'sleetcord'
import { modmail_forum_config } from './config.js'

export const modmail_forum = new SleetSlashCommandGroup({
  name: 'forum',
  description: 'Manage modmail forum settings',
  options: [modmail_forum_config],
})
