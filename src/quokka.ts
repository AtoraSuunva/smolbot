type Range = [string, string]

const ranges = `  [\u0180-\u02AF]
  |[\u0370-\u13FF]
  |[\u141D-\u1FFF]
  |[\u2090-\u209F]
  |[\u2100-\u214F]
  |[\u2400-\u245F]
  |[\u249C-\u24E9]
  |[\u2500-\u259F]
  |[\u2800-\u28FF]
  |[\u2C00-\u2E7F]
  |[\u3100-\u31BF]
  |[\uA000-\uF8FF]
  |[\uFB00-\uFDFF]
  |[\u{10000}-\u{1D0FF}]
  |[\u{1D200}-\u{1EEFF}]`
  .split('\n')
  .map(
    (s) =>
      s
        .trim()
        .match(/^\|?\[(.*)-(.*)\]$/)
        ?.splice(1, 2) ?? '',
  ) as Range[]

const chars = `꒳
™️
™
π
ω
ง
Ɛ`.split('\n')

function inRange(char: string, [start, end]: Range) {
  return char >= start && char <= end
}

for (const c of chars) {
  if (!c) continue

  const charRange = ranges.find((r) => inRange(c, r))

  if (charRange) {
    console.log(c, charRange)
  } else {
    console.log(c, 'not in any range')
  }
}

// console.log(parseInt('20A0', 16), (parseInt('20A0', 16) - 1).toString(16))
