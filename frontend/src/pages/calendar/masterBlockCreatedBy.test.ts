import { describe, expect, it } from 'vitest'
import { masterBlockCreatedByLabel } from './masterBlockCreatedBy'
import type { MasterBlock } from '../../types/masterBlock'

function block(overrides: Partial<MasterBlock>): MasterBlock {
  return {
    id: 'block-1',
    salonId: 'salon-1',
    masterId: 'master-1',
    startTime: '2026-01-10T10:00:00.000Z',
    endTime: '2026-01-10T11:00:00.000Z',
    reason: null,
    createdAt: '2026-01-10T09:00:00.000Z',
    createdById: null,
    ...overrides,
  }
}

describe('masterBlockCreatedByLabel', () => {
  it('shows "Создано вами" when the viewer created the block themselves', () => {
    expect(
      masterBlockCreatedByLabel(block({ createdById: 'user-1', createdByRole: 'MASTER', createdBySelf: true })),
    ).toBe('Создано вами')
  })

  it('shows "Создано администратором" when an ADMIN created it and the viewer is not them', () => {
    expect(
      masterBlockCreatedByLabel(block({ createdById: 'admin-1', createdByRole: 'ADMIN', createdBySelf: false })),
    ).toBe('Создано администратором')
  })

  it('shows "Создано мастером" when another MASTER created it', () => {
    expect(
      masterBlockCreatedByLabel(block({ createdById: 'master-2', createdByRole: 'MASTER', createdBySelf: false })),
    ).toBe('Создано мастером')
  })

  it('returns null for pre-migration blocks without a recorded creator', () => {
    expect(masterBlockCreatedByLabel(block({ createdById: null, createdByRole: null, createdBySelf: false }))).toBe(
      null,
    )
  })
})
