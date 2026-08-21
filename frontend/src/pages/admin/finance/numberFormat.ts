// Модель Payment не несёт код валюты (см. prisma/schema.prisma) — показываем сумму без символа,
// только с локальной группировкой разрядов/десятичных, как и остальные суммы в проекте.
const amountFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatAmount(value: number): string {
  return amountFormatter.format(value)
}
