import { ApplicationIntegrationType, InteractionContextType } from 'discord.js'
import { SleetSlashCommand } from 'sleetcord'
import { warningsAdd } from './add.js'
import { warningsEdit } from './edit.js'
import { warningsExport } from './export.js'
import { warningsHistory } from './history.js'
import { importWarnings } from './import_warnings.js'
import { myWarnings } from './my_warnings.js'
import { warningsRevert } from './revert.js'
import { warningsSearch } from './search.js'

export const warnings = new SleetSlashCommand(
  {
    name: 'warnings',
    description: 'Manage warnings on the server',
    default_member_permissions: ['ModerateMembers'],
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [
      warningsAdd,
      warningsSearch,
      warningsEdit,
      warningsHistory,
      warningsRevert,
      warningsExport,
    ],
  },
  {},
  [importWarnings, myWarnings],
)
