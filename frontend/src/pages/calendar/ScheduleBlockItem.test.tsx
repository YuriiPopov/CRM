import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScheduleBlockItem } from './ScheduleBlockItem'
import type { MasterBlock } from '../../types/masterBlock'
import type { Master } from '../../types/staff'

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Анна',
  specialization: 'MANICURE_PEDICURE',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

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

describe('ScheduleBlockItem', () => {
  // Регрессия: "Моё расписание" (роль MASTER) не грузит полный список мастеров (Backlog п.5),
  // поэтому master приходит undefined — раньше это давало fallback 'Мастер не найден'.
  it('never renders the "Мастер не найден" fallback when master is undefined', () => {
    render(
      <ul>
        <ScheduleBlockItem
          block={block({ createdById: 'user-1', createdByRole: 'MASTER', createdBySelf: true })}
          master={undefined}
          showMasterName
          canDelete
          onDelete={vi.fn()}
          busy={false}
        />
      </ul>,
    )

    expect(screen.queryByText('Мастер не найден')).not.toBeInTheDocument()
    expect(screen.getByText('Создано вами')).toBeInTheDocument()
  })

  it('shows the master name for admin screens where master is resolved', () => {
    render(
      <ul>
        <ScheduleBlockItem
          block={block({ createdById: 'admin-1', createdByRole: 'ADMIN', createdBySelf: true })}
          master={master}
          showMasterName
          canDelete
          onDelete={vi.fn()}
          busy={false}
        />
      </ul>,
    )

    expect(screen.getByText('Анна')).toBeInTheDocument()
  })

  it('shows no created-by label for pre-migration blocks without a recorded creator', () => {
    render(
      <ul>
        <ScheduleBlockItem
          block={block({ createdById: null, createdByRole: null, createdBySelf: false })}
          master={undefined}
          showMasterName
          canDelete
          onDelete={vi.fn()}
          busy={false}
        />
      </ul>,
    )

    expect(screen.queryByText('Мастер не найден')).not.toBeInTheDocument()
    expect(screen.queryByText(/Создано/)).not.toBeInTheDocument()
  })
})
