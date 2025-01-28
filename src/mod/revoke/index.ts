import { ApplicationIntegrationType, InteractionContextType } from 'discord.js'
import { SleetSlashCommand } from 'sleetcord'
import { revoke_config } from './config.js'
import { revoke_invites } from './invites.js'

export const revoke = new SleetSlashCommand({
  name: 'revoke',
  description: 'Revoke invites or config autorevoke settings',
  contexts: [InteractionContextType.Guild],
  integration_types: [ApplicationIntegrationType.GuildInstall],
  default_member_permissions: ['BanMembers'],
  options: [revoke_invites, revoke_config],
})
