import { getMasterColor } from './masterColor'

describe('getMasterColor', () => {
  it('is deterministic — the same masterId always returns the same color', () => {
    expect(getMasterColor('master-1')).toBe(getMasterColor('master-1'))
  })

  it('returns a valid non-empty CSS color for any id', () => {
    expect(getMasterColor('some-uuid-1234')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('is stable across separate calls regardless of surrounding calls for other ids', () => {
    const first = getMasterColor('master-a')
    getMasterColor('master-b')
    getMasterColor('master-c')
    const again = getMasterColor('master-a')
    expect(again).toBe(first)
  })

  it('distributes different ids across more than one color (not a constant)', () => {
    const colors = new Set(
      ['master-1', 'master-2', 'master-3', 'master-4', 'master-5', 'master-6'].map((id) => getMasterColor(id)),
    )
    expect(colors.size).toBeGreaterThan(1)
  })
})
