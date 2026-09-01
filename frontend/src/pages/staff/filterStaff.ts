import type { Master } from '../../types/staff'

// Backend не даёт параметра поиска в GET /staff — тот же подход, что и в filterClients.ts.
// Пустой набор categoryIds — фильтр по категориям не применяется (показываются все мастера).
// Иначе — мастер проходит, если у него есть хотя бы одна из выбранных категорий (условие ИЛИ).
// includeInactive — дополняющий фильтр (не переключатель): false оставляет только активных,
// true добавляет к ним неактивных, а не заменяет одних другими (item30).
export function filterStaff(
  masters: Master[],
  query: string,
  categoryIds: Set<string> = new Set(),
  includeInactive = false,
): Master[] {
  const normalized = query.trim().toLowerCase()

  return masters
    .filter((master) => includeInactive || master.isActive)
    .filter((master) => !normalized || master.name.toLowerCase().includes(normalized))
    .filter(
      (master) =>
        categoryIds.size === 0 ||
        master.specializationCategoryIds.some((id) => categoryIds.has(id)),
    )
}
