import { ApplicationIntegrationType, InteractionContextType } from 'discord.js'
import { SleetSlashCommand } from 'sleetcord'
import { actionlog_config } from './actionlog_config.js'
import { actionlog_history } from './actionlog_history.js'
import { logAction } from './logAction.js'
import { actionReason } from './reason.js'

const actionlog = new SleetSlashCommand({
  name: 'actionlog',
  description: 'Manage the action logging system',
  default_member_permissions: ['ManageGuild'],
  contexts: [InteractionContextType.Guild],
  integration_types: [ApplicationIntegrationType.GuildInstall],
  options: [actionlog_config, actionlog_history],
})

export const actionLogModules = [actionlog, logAction, actionReason]
