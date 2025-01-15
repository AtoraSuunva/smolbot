import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js'
import { PreRunError, SleetSlashCommand } from 'sleetcord'

/**
 * Generate a minesweeper grid that you can play using spoilers
 *
 * Because it was funny when spoilers first came out
 */
export const minesweeper = new SleetSlashCommand(
  {
    name: 'minesweeper',
    description: 'Play a minesweeper game',
    options: [
      {
        name: 'mines',
        type: ApplicationCommandOptionType.Integer,
        description: 'The number of mines to use (default: based on grid size)',
        min_value: 1,
        max_value: 20,
      },
      {
        name: 'width',
        type: ApplicationCommandOptionType.Integer,
        description: 'The width of the board (default: 7)',
        min_value: 1,
        max_value: 20,
      },
      {
        name: 'height',
        type: ApplicationCommandOptionType.Integer,
        description: 'The height of the board (default: 7)',
        min_value: 1,
        max_value: 20,
      },
    ],
  },
  {
    run: runMinesweeper,
  },
)

/** Minesweeper time! */
function runMinesweeper(interaction: ChatInputCommandInteraction) {
  const mines = interaction.options.getInteger('mines') ?? 0
  const width = interaction.options.getInteger('width') ?? 7
  const height = interaction.options.getInteger('height') ?? 7

  if (mines > width * height) {
    throw new PreRunError(
      "There are too many mines, they can't all fit in the grid!!",
    )
  }

  const { grid, minecount, safe } = createMinesweeper(height, width, mines)

  const message = `*Mines: ${minecount}*\n${grid
    .map((row, y) =>
      row
        .map((v, x) =>
          safe[0] === y && safe[1] === x ? charMap(v) : `||${charMap(v)}||`,
        )
        .join(''),
    )
    .join('\n')}`

  if (message.length > 2000) {
    return interaction.reply({
      content: 'The board is too big! Try a smaller one!',
      flags: MessageFlags.Ephemeral,
    })
  }

  return interaction.reply(message)
}

/** Map from numbers to the emojis */
const nMap = {
  0: ':zero:',
  1: ':one:',
  2: ':two:',
  3: ':three:',
  4: ':four:',
  5: ':five:',
  6: ':six:',
  7: ':seven:',
  8: ':eight:',
  9: ':nine:',
}

/** Map a character to the "display emoji", either a bomb 💣 or a number 1️⃣ */
const charMap = (c: string | number) =>
  c === MINE ? ':bomb:' : nMap[c as keyof typeof nMap]

/** Char to use for the mine */
const MINE = 'X'

/**
 * The required data for a game of minesweeper
 */
interface MinesweeperGame {
  /** The game grid itself, as a 2d array of strings/numbers (grid[y][x]) */
  grid: Grid
  /** The number of mines in the grid */
  minecount: number
  /** A point guaranteed to be safe (x, y) */
  safe: [number, number]
}

/**
 * Create a minesweeper game, generating a board, counting the mines, and picking a safe spot
 * @param height The height of the board
 * @param width The width of the board
 * @param mines The number of mines to use (if 0, will automatically be calculated based on board size)
 * @returns A whole minesweeper game ready to be deployed
 */
function createMinesweeper(height = 7, width = 7, mines = 0): MinesweeperGame {
  const minesToPlace = mines || Math.floor((height * width) / 4) || 1
  let minecount = 0
  let safe: [number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ]
  const grid = genGrid(height, width)

  for (let i = 0; i < minesToPlace; i++) {
    const x = randInt(0, width - 1)
    const y = randInt(0, height - 1)
    if (grid[y][x] === MINE) i--
    grid[y][x] = MINE
  }

  // Now to place the "counts"
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y]?.[x] === MINE) {
        minecount++
        continue
      }

      // 50% chance to swap safe spot
      if (safe[0] === Number.POSITIVE_INFINITY || Math.floor(Math.random() * 2))
        safe = [y, x]
      grid[y][x] = countMines(x, y, grid)
    }
  }

  // Make it a regular array and not a Proxy
  return { grid: Array.from(grid), minecount, safe }
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Grid moment */
type Grid = (number | string)[][]

/**
 * Generate a grid of 0s
 * @param height The height of the grid
 * @param width The width of the grid
 * @returns A grid of 0s
 */
function genGrid(height: number, width: number): Grid {
  return Array.from(Array(height)).map(() => Array(width).fill(0))
}

// Get the 8 tiles around the tile, counting the num of mines
function countMines(x: number, y: number, grid: Grid): number {
  return [
    grid[y - 1]?.[x - 1],
    grid[y - 1]?.[x],
    grid[y - 1]?.[x + 1],
    grid[y]?.[x - 1],
    grid[y]?.[x + 1],
    grid[y + 1]?.[x - 1],
    grid[y + 1]?.[x],
    grid[y + 1]?.[x + 1],
  ].filter((v) => v === MINE).length
}
