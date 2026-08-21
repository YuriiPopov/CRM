import { useEffect, useMemo, useState } from 'react'
import { getRevenueReport } from '../../api/payments'
import { getApiErrorMessage } from '../../api/errors'
import { todayDateOnly } from '../calendar/dateUtils'
import {
  PRESET_LABELS,
  presetRange,
  toInclusiveEndOfDayIso,
  validateRange,
} from './finance/dateRangePresets'
import { formatAmount } from './finance/numberFormat'
import type { DateRange, PresetKey } from './finance/dateRangePresets'
import type { RevenueReport } from '../../types/payment'

const PRESET_KEYS: PresetKey[] = ['today', 'thisWeek', 'thisMonth', 'lastMonth']

export function FinancePage() {
  const today = todayDateOnly()

  const [activePreset, setActivePreset] = useState<PresetKey | null>('thisMonth')
  const [range, setRange] = useState<DateRange>(() => presetRange('thisMonth', today))
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const validationError = useMemo(() => validateRange(range, today), [range, today])

  useEffect(() => {
    if (validationError) {
      // Невалидный период — нечего грузить, спиннер тут только маскировал бы сообщение об ошибке.
      // oxlint-disable-next-line react/set-state-in-effect
      setLoading(false)
      return
    }

    let cancelled = false
    // Смена периода (пресет или ручной ввод даты) не размонтирует страницу — сброс здесь
    // синхронизирует UI с новым запросом (см. тот же паттерн в StaffDetailPage/ClientDetailPage).
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    setLoadError(null)

    getRevenueReport({ from: range.from, to: toInclusiveEndOfDayIso(range.to) })
      .then((data) => {
        if (!cancelled) setReport(data)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(error, 'Не удалось загрузить отчёт по выручке'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [range, validationError])

  const handlePreset = (preset: PresetKey) => {
    setActivePreset(preset)
    setRange(presetRange(preset, today))
  }

  const handleCustomChange = (field: 'from' | 'to', value: string) => {
    setActivePreset(null)
    setRange((prev) => ({ ...prev, [field]: value }))
  }

  const maxAmount = report
    ? Math.max(report.grossAmount, report.totalDiscount, report.netRevenue, 1)
    : 1

  return (
    <section>
      <h1>Финансы</h1>

      <div className="calendar-toolbar">
        {PRESET_KEYS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={activePreset === preset ? 'slot-button-selected' : undefined}
            onClick={() => handlePreset(preset)}
          >
            {PRESET_LABELS[preset]}
          </button>
        ))}

        <label htmlFor="finance-from">
          С
          <input
            id="finance-from"
            type="date"
            value={range.from}
            onChange={(event) => handleCustomChange('from', event.target.value)}
          />
        </label>
        <label htmlFor="finance-to">
          По
          <input
            id="finance-to"
            type="date"
            value={range.to}
            onChange={(event) => handleCustomChange('to', event.target.value)}
          />
        </label>
      </div>

      {validationError && <p role="alert">{validationError}</p>}
      {!validationError && loadError && <p role="alert">{loadError}</p>}

      {!validationError && loading && <p>Загрузка…</p>}

      {!validationError && !loading && report && (
        <>
          {report.paymentsCount === 0 ? (
            <p>За выбранный период платежей не было</p>
          ) : (
            <>
              <table className="finance-table">
                <tbody>
                  <tr>
                    <th scope="row">Валовая выручка</th>
                    <td>{formatAmount(report.grossAmount)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Скидки</th>
                    <td>{formatAmount(report.totalDiscount)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Чистая выручка</th>
                    <td>{formatAmount(report.netRevenue)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Количество платежей</th>
                    <td>{report.paymentsCount}</td>
                  </tr>
                </tbody>
              </table>

              <div className="finance-chart" role="group" aria-label="График по выручке">
                <div className="finance-chart-row">
                  <span className="finance-chart-row-label">Валовая выручка</span>
                  <span className="finance-chart-bar-track">
                    <span
                      className="finance-chart-bar"
                      role="img"
                      aria-label={`Валовая выручка: ${formatAmount(report.grossAmount)}`}
                      style={{ width: `${(report.grossAmount / maxAmount) * 100}%` }}
                    />
                  </span>
                </div>
                <div className="finance-chart-row">
                  <span className="finance-chart-row-label">Скидки</span>
                  <span className="finance-chart-bar-track">
                    <span
                      className="finance-chart-bar finance-chart-bar-discount"
                      role="img"
                      aria-label={`Скидки: ${formatAmount(report.totalDiscount)}`}
                      style={{ width: `${(report.totalDiscount / maxAmount) * 100}%` }}
                    />
                  </span>
                </div>
                <div className="finance-chart-row">
                  <span className="finance-chart-row-label">Чистая выручка</span>
                  <span className="finance-chart-bar-track">
                    <span
                      className="finance-chart-bar finance-chart-bar-net"
                      role="img"
                      aria-label={`Чистая выручка: ${formatAmount(report.netRevenue)}`}
                      style={{ width: `${(report.netRevenue / maxAmount) * 100}%` }}
                    />
                  </span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
