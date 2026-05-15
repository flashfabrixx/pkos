const PALETTE = [
  { bg: '#e0f2fe', fg: '#075985' },
  { bg: '#dcfce7', fg: '#166534' },
  { bg: '#fef3c7', fg: '#92400e' },
  { bg: '#fee2e2', fg: '#b42318' },
  { bg: '#ede9fe', fg: '#5b21b6' },
  { bg: '#ffe4e6', fg: '#9f1239' },
  { bg: '#cffafe', fg: '#155e75' },
  { bg: '#f1f5f9', fg: '#334155' }
]

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function colorFor(value: string | null | undefined) {
  if (!value) return PALETTE[PALETTE.length - 1]!
  return PALETTE[hashString(value) % PALETTE.length]!
}
