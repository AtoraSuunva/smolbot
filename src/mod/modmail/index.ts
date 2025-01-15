import { SleetSlashCommand } from 'sleetcord'

import { ApplicationIntegrationType, InteractionContextType } from 'discord.js'
import { modmail_fields } from './fields/index.js'
import { modmail_forum } from './forum/index.js'
import { handle_thread_update } from './handle_thread_update.js'
import { handle_ticket_message } from './handle_ticket_message.js'
import { modmail_server } from './server/index.js'
import { modmail_ticket } from './ticket/index.js'

export const modmail = new SleetSlashCommand(
  {
    name: 'modmail',
    description: 'Manage modmail settings',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    default_member_permissions: ['ManageGuild'],
    options: [modmail_fields, modmail_ticket, modmail_server, modmail_forum],
  },
  {},
  [handle_ticket_message, handle_thread_update],
)
