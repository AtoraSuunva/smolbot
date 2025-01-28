import { ApplicationIntegrationType, InteractionContextType } from 'discord.js'
import { SleetSlashCommand } from 'sleetcord'
import { antiraid_check } from './check.js'
import { antiraid_config } from './config.js'

const antiraid = new SleetSlashCommand({
  name: 'antiraid',
  description: 'Configure the antiraid module',
  options: [antiraid_config, antiraid_check],
  contexts: [InteractionContextType.Guild],
  integration_types: [ApplicationIntegrationType.GuildInstall],
  default_member_permissions: ['ManageGuild'],
})

export const antiraidModules = [antiraid]
