import type { SleetModule } from 'sleetcord'
import { logging, sentryLogger } from 'sleetcord-common'
import { miscModules } from './misc/index.js'
import { modModules } from './mod/index.js'
import { secretModules } from './secret/index.js'
import { utilityModules } from './utility/index.js'

export const modules: SleetModule[] = [
  ...miscModules,
  ...modModules,
  ...secretModules,
  ...utilityModules,
  logging,
  sentryLogger,
]
