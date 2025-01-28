// import { automod } from './automod/automod.js'
import { actionLogModules } from './actionlog/index.js'
import { manual_log } from './actionlog/manual_log.js'
import { antiraidModules } from './antiraid/index.js'
import { maliciousFile } from './automod/maliciousFile.js'
import { dehoist } from './dehoist.js'
import { delete_police_config } from './delete_police_config.js'
import { idof } from './idof.js'
import { lock_thread } from './lock_thread/lock_thread.js'
import { lock_thread_config } from './lock_thread/lock_thread_config.js'
import { lookup } from './lookup.js'
import {
  mass_ban,
  mass_find,
  mass_kick,
  mass_softban,
  mass_unban,
} from './mass_action.js'
import { messageDeleteAuditLog } from './messageDeleteAuditLog.js'
import { modlogModules } from './modlog/index.js'
import { modmail } from './modmail/index.js'
import { muteModules } from './mute/index.js'
import { purge } from './purge.js'
import { report } from './report/report.js'
import { revoke } from './revoke/index.js'
import { unedit, unedit_message } from './unedit.js'
import { vc_log } from './vc_log.js'
import { warningsModules } from './warnings/index.js'
import { welcome } from './welcome/welcome.js'

export const modModules = [
  ...actionLogModules,
  ...antiraidModules,
  ...modlogModules,
  ...muteModules,
  ...warningsModules,
  // automod,
  modmail,
  dehoist,
  delete_police_config,
  idof,
  lock_thread,
  lock_thread_config,
  lookup,
  maliciousFile,
  manual_log,
  mass_ban,
  mass_find,
  mass_kick,
  mass_softban,
  mass_unban,
  messageDeleteAuditLog,
  purge,
  report,
  revoke,
  unedit_message,
  unedit,
  vc_log,
  welcome,
]
