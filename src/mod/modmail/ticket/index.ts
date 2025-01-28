import { SleetSlashCommandGroup } from 'sleetcord'
import { modmail_ticket_config } from './config.js'
import { modmail_ticket_create_button } from './create_button.js'
import { modmail_ticket_delete } from './delete.js'

export const modmail_ticket = new SleetSlashCommandGroup({
  name: 'ticket',
  description: 'Manage modmail tickets',
  options: [
    modmail_ticket_config,
    modmail_ticket_create_button,
    modmail_ticket_delete,
  ],
})
