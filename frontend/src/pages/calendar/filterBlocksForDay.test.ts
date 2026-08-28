import { filterBlocksForRange } from './filterBlocksForDay'
import type { MasterBlock } from '../../types/masterBlock'

function makeBlock(overrides: Partial<MasterBlock>): MasterBlock {
  return {
    id: 'block-1',
    salonId: 'salon-1',
    masterId: 'master-1',
    startTime: '2026-03-10T09:00:00.000Z',
    endTime: '2026-03-10T10:00:00.000Z',
    reason: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    createdById: null,
    ...overrides,
  }
}

describe('filterBlocksForRange', () => {
  const dates = ['2026-03-09', '2026-03-10']

  it('keeps only blocks intersecting a day in the given range', () => {
    const inRange = makeBlock({ id: 'b-in-range', startTime: '2026-03-09T09:00:00.000Z', endTime: '2026-03-09T10:00:00.000Z' })
    const outsideRange = makeBlock({ id: 'b-outside', startTime: '2026-03-15T09:00:00.000Z', endTime: '2026-03-15T10:00:00.000Z' })
    const result = filterBlocksForRange([inRange, outsideRange], dates)
    expect(result.map((b) => b.id)).toEqual(['b-in-range'])
  })

  it('keeps a multi-day block that only overlaps one day of the range', () => {
    const spanning = makeBlock({
      id: 'b-spanning',
      startTime: '2026-03-08T18:00:00.000Z',
      endTime: '2026-03-09T06:00:00.000Z',
    })
    expect(filterBlocksForRange([spanning], dates).map((b) => b.id)).toEqual(['b-spanning'])
  })

  it('deduplicates a block spanning multiple days within the range (appears once)', () => {
    const spanningBothDays = makeBlock({
      id: 'b-both',
      startTime: '2026-03-09T18:00:00.000Z',
      endTime: '2026-03-10T06:00:00.000Z',
    })
    expect(filterBlocksForRange([spanningBothDays], dates).map((b) => b.id)).toEqual(['b-both'])
  })

  it('further narrows to a single master when masterId is given', () => {
    const forMasterOne = makeBlock({ id: 'b-m1', masterId: 'master-1' })
    const forMasterTwo = makeBlock({ id: 'b-m2', masterId: 'master-2' })
    const result = filterBlocksForRange([forMasterOne, forMasterTwo], dates, 'master-2')
    expect(result.map((b) => b.id)).toEqual(['b-m2'])
  })

  it('sorts results by start time', () => {
    const late = makeBlock({ id: 'b-late', startTime: '2026-03-10T14:00:00.000Z', endTime: '2026-03-10T15:00:00.000Z' })
    const early = makeBlock({ id: 'b-early', startTime: '2026-03-09T09:00:00.000Z', endTime: '2026-03-09T10:00:00.000Z' })
    expect(filterBlocksForRange([late, early], dates).map((b) => b.id)).toEqual(['b-early', 'b-late'])
  })
})
