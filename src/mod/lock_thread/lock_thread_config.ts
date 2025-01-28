import { ApplicationIntegrationType, InteractionContextType } from 'discord.js'
import { SleetSlashCommand } from 'sleetcord'
import { lock_thread_config_delete } from './lock_thread_config_delete.js'
import { lock_thread_config_set } from './lock_thread_config_set.js'

export const lock_thread_config = new SleetSlashCommand({
  name: 'lock_thread_config',
  description: 'Manage the lock thread config',
  contexts: [InteractionContextType.Guild],
  integration_types: [ApplicationIntegrationType.GuildInstall],
  default_member_permissions: ['ManageGuild'],
  options: [lock_thread_config_set, lock_thread_config_delete],
})
