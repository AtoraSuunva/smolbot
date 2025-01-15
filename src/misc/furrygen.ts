import { type ChatInputCommandInteraction, codeBlock } from 'discord.js'
import { SleetSlashCommand } from 'sleetcord'

/** Generates a random fursona! */
export const furrygen = new SleetSlashCommand(
  {
    name: 'furrygen',
    description: 'Generate a random fursona!',
  },
  {
    run: runFurrygen,
  },
)

/** Generate a fursona */
async function runFurrygen(interaction: ChatInputCommandInteraction) {
  const lines: string[] = []

  for (const field of fieldList) {
    const val = arrayPick(fields[field as keyof typeof fields])
    const formattedVal = typeof val === 'function' ? val() : (val ?? 'None')
    lines.push(`${field.padEnd(maxFieldLength)} :: ${formattedVal}`)
  }

  await interaction.reply({
    content: 'Here is your assigned fursona!',
    embeds: [
      {
        description: codeBlock('asciidoc', lines.join('\n')),
      },
    ],
  })
}

/** Colors to pick for a random color scheme */
const colors: string[] = [
  'Red',
  'Blue',
  'Green',
  'Teal',
  'Tan',
  'Pink',
  'Orange',
  'White',
  'Grey',
  'Black',
  'Brown',
  'Purple',
  'Indigo',
  'Gold',
  'Bronze',
  'Silver',
  'Yellow',
  'Cyan',
]

/**
 * Generate a random 3-color color scheme
 */
function genColorScheme() {
  const c: string[] = []

  while (c.length < 3) {
    const cAdd = arrayPick(colors) ?? 'Red'
    if (c.includes(cAdd)) continue
    c.push(cAdd)
  }

  return c.join(', ')
}

/**
 * Defines the fields for a fursona, along with some possible choices
 */
const fields = {
  Species: [
    'Dragon',
    'Dog',
    'House Cat',
    'Red Fox',
    'Hawk',
    'Tiger',
    'Wolf',
    'Raccoon',
    'Shark',
    'Sergal',
    'Lion',
    'Panda',
    'Horse',
    'Snail',
    'Bull',
    'Cheetah',
    'Deer',
    'Crocodile',
    'Seagull',
    'Protogen',
    'Wickerbeast',
    'Bat',
    'Axotl',
    'Lizard',
    'Kobold',
    'Bird',
    'Raptor',
    'Rabbit',
    'Bunny',
    'Mouse',
    'Rat',
    'Otter',
    'Badger',
    'Penguin',
    'Ferret',
    'Ermine',
    'Husky',
    'Panda',
    'Elephant',
    'Giraffe',
    'Red Panda',
    'Goat',
    'Skunk',
    'Hyena',
    'Coyote',
    'Panther',
    'Puma',
    'Whale',
    'Walrus',
    'Snow Leopard',
    'Dingo',
    'Bear',
    'Cheetah',
    'Lynx',
    'Monkey',
    'Kangaroo',
    'Great Dane',
    'Artic Fox',
    'Fennec Fox',
    'Doberman',
    'Gorilla',
    'Border Collie',
    'Squirrel',
    'German Shephard',
    'Polar Bear',
    'Alligator',
    'Antelope',
    'Caracal',
    'Chinchilla',
    'Goose',
    'Duck',
    'Crocodile',
    'Crow',
    'Bluejay',
    'Dolphin',
    'Badger',
    'Artic Wolf',
    'Gray Wolf',
    'Black Wolf',
    'Sheep',
    'Kitsune',
    'Hedgehog',
    'Shiba Inu',
    'Jaguar',
    'Werewolf',
    'Jackal',
    'Pony',
    'Cougar',
    'Dalmatian',
    'Gryphon',
    'Unicorn',
    'Chimera',
    'Maned Wolf',
    'Jackalope',
    'Bee',
    'Moth',
    'Armadillo',
    'Mole',
    'Porcupine',
    'Pine Marten',
    'Meerkat',
    'Weasel',
    'Mongoose',
    'Mole',
    'Lemur',
    'Pig',
    'Boar',
    'Pangolin',
    'Platypus',
    'Sloth',
    'Beaver',
    'Anteater',
    'Antelope',
    'Chicken',
    'Donkey',
    'Fossa',
    'Okapi',
    'Rhino',
    'Swift Fox',
    'Phoenix',
    'Minotaur',
    'Lizardman',
    'Naga',
    'Snake',
    'Cobra',
    'Gargoyle',
    'Quetzalcoatl',
    'Raven',
    'Serval',
    'Hamster',
    'Mink',
    'Skaven',
    'Eastern Dragon',
    'Eevee',
    'Jolteon',
    'Flareon',
    'Vaporeon',
    'Espeon',
    'Umbreon',
    'Glaceon',
    'Leafeon',
    'Sylveon',
    'Hand Bag',
  ],

  Colors: [
    'Blue, Teal, Tan',
    'Pink, Pastel Orange, White',
    'Orange, Grey, Black',
    'Green, Pink, Black',
    'Red, Grey, Orange',
    'Tan, Orange, Brown',
    'Blue, Grey, White',
    'Black, White, Grey',
    'Brown, Orange, Pink',
    'Orange, Black, Green',
    'White, Green, Purple',
    'Indigo, Red, Blue',
    'Pink, Yellow, Teal',
    'Yellow, Brown, Green',
    'Red, Yellow, White',
    'Blue, Orange, White',
    'Gold, Red, Pink',
    'Silver, Blue, Green',
    'Copper, Black, Grey',
    'Crayons in a Blender',
    genColorScheme, // Generate a random scheme with 3 colors
  ],

  Likes: [
    'Swimming',
    'Climbing',
    'Shopping',
    'Playing Games',
    'History',
    'Reading',
    'Movies',
    'Eating',
    'Cooking',
    'Exploring',
    'Painting',
    'Crafting',
    'Math',
    'Acting',
    'Drawing',
    'Fashion',
    'Racing',
    'Writing',
    'Sports',
    'Sleeping',
    'Hand Bags',
  ],

  Collects: [
    'Stamps',
    'Coins',
    'Figures',
    'Hats',
    'Shirts',
    'Books',
    'Records',
    'Plushies',
    'Pins',
    'Memorabilia',
    'Cards',
    'Toys',
    'Cheesegraters',
    'Bottle Caps',
    'Sunglasses',
    'Art',
    'Trinkets',
    'Postcards',
    'Shoes',
    'Scarves',
    'Hand Bags',
    'Feathers',
  ],

  Accessory: [
    'Hat',
    'Sunglasses',
    'Scarf',
    'Keychain',
    'Gloves',
    'Backpack',
    'Ring',
    'Necklace',
    'Ear Ring(s)',
    'Belt',
    'Jacket',
    'Hand Bag',
    'Glasses',
    'Sweater',
    'Helmet',
    'Bracelet(s)',
    'Bangle(s)',
    'Bandanna',
    'Hoodie',
    'Cape',
  ],
}

/** A list of the keys */
const fieldList = Object.keys(fields)
/** Get the length of the longest key so we can format it nicely */
const maxFieldLength =
  fieldList
    .map((v) => v.length)
    .sort()
    .pop() ?? 0

/**
 * Generate a random int between two bounds, inclusive
 * @param min The lower bound
 * @param max The upper bound
 * @returns A random int between [min, max], inclusive
 */
function randInt(min: number, max: number): number {
  const min2 = Math.ceil(min)
  const max2 = Math.floor(max)
  return Math.floor(Math.random() * (max2 - min2 + 1)) + min2
}

/**
 * Pick a random element from an array
 * @param array The array to pick from
 * @returns A random element from that array
 */
function arrayPick<T>(array: T[]): T | undefined {
  return array[randInt(0, array.length - 1)]
}
