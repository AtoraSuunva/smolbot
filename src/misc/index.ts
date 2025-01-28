import { activity, info, ping, stats } from 'sleetcord-common'
import { autoreply, thanksAutoreply } from './autoreply.js'
import { choose } from './choose.js'
import { flip } from './flip.js'
import { furrygen } from './furrygen.js'
import { minesweeper } from './minesweeper.js'
import { roll } from './roll.js'

export const miscModules = [
  activity,
  autoreply,
  choose,
  flip,
  furrygen,
  info,
  minesweeper,
  ping,
  roll,
  stats,
  thanksAutoreply,
]
