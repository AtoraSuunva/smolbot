import { SleetSlashCommandGroup } from 'sleetcord'
import { modmail_server_config } from './config.js'

export const modmail_server = new SleetSlashCommandGroup({
  name: 'server',
  description: 'Manage modmail server settings',
  options: [modmail_server_config],
})
