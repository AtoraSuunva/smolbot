import { ApplicationIntegrationType, InteractionContextType } from 'discord.js'
import { SleetModule, SleetSlashCommand } from 'sleetcord'
import { logAuditLog } from './handlers/auditLog/index.js'
import { logGuildMemberAdd } from './handlers/guildMemberAdd.js'
import { logGuildMemberRemove } from './handlers/guildMemberRemove.js'
import { logMessageDelete } from './handlers/messageDelete.js'
import { logMessageDeleteBulk } from './handlers/messageDeleteBulk.js'
import { modlogMessageReactionAdd } from './handlers/messageReactionAdd.js'
import { logReactionRemove } from './handlers/reactionRemove.js'
import { logUserUpdate } from './handlers/userUpdate.js'
import { modlog_channels } from './modlog_channels.js'
import { modlog_config } from './modlog_config.js'

export const modlog = new SleetSlashCommand({
  name: 'modlog',
  description: 'Manage the modlog configuration',
  options: [modlog_config, modlog_channels],
  contexts: [InteractionContextType.Guild],
  integration_types: [ApplicationIntegrationType.GuildInstall],
  default_member_permissions: ['ManageGuild'],
})

export const modlogHandlers = new SleetModule(
  {
    name: 'modlogHandlers',
  },
  {},
  [
    logAuditLog,
    logGuildMemberAdd,
    logGuildMemberRemove,
    logMessageDelete,
    logMessageDeleteBulk,
    logReactionRemove,
    logUserUpdate,
    modlogMessageReactionAdd,
  ],
)
