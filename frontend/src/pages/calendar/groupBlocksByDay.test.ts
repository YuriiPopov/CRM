import { groupBlocksByDay } from './groupBlocksByDay'
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

describe('groupBlocksByDay', () => {
  const dates = ['2026-03-09', '2026-03-10', '2026-03-11']

  it('creates a bucket for every date, even with no blocks', () => {
    const byDay = groupBlocksByDay([], dates)
    expect(Array.from(byDay.keys())).toEqual(dates)
    expect(byDay.get('2026-03-09')).toEqual([])
  })

  it('puts a block spanning midnight into both days it overlaps', () => {
    const spanning = makeBlock({
      id: 'b-spanning',
      startTime: '2026-03-09T18:00:00.000Z',
      endTime: '2026-03-10T06:00:00.000Z',
    })
    const byDay = groupBlocksByDay([spanning], dates)
    expect(byDay.get('2026-03-09')!.map((b) => b.id)).toEqual(['b-spanning'])
    expect(byDay.get('2026-03-10')!.map((b) => b.id)).toEqual(['b-spanning'])
    expect(byDay.get('2026-03-11')).toEqual([])
  })

  it('sorts blocks within a day by start time', () => {
    const late = makeBlock({ id: 'b-late', startTime: '2026-03-10T14:00:00.000Z', endTime: '2026-03-10T15:00:00.000Z' })
    const early = makeBlock({ id: 'b-early', startTime: '2026-03-10T09:00:00.000Z', endTime: '2026-03-10T10:00:00.000Z' })
    const byDay = groupBlocksByDay([late, early], dates)
    expect(byDay.get('2026-03-10')!.map((b) => b.id)).toEqual(['b-early', 'b-late'])
  })

  it('drops blocks that fall entirely outside the given range', () => {
    const outside = makeBlock({ id: 'b-outside', startTime: '2026-04-01T09:00:00.000Z', endTime: '2026-04-01T10:00:00.000Z' })
    const byDay = groupBlocksByDay([outside], dates)
    expect(Array.from(byDay.values()).flat()).toEqual([])
  })
})
