// Чистые функции сборки клиентского каталога (item88) — без Prisma, чтобы тестировать отдельно.

export interface CoverSourceService {
  categoryId: string;
  createdAt: Date;
  coverPhotoId: string | null;
}

export interface CompletedVisit {
  serviceId: string;
  masterId: string;
  startTime: Date;
}

export interface ClientServiceEntry {
  serviceId: string;
  lastMasterId: string;
  lastVisitAt: Date;
}

// Обложка категории — обложка первой по дате создания услуги категории, у которой есть фото.
// Нет ни одного фото → категории нет в результате (клиент рисует заглушку).
export function categoryCoverPhotoIds(
  services: CoverSourceService[],
): Map<string, string> {
  const covers = new Map<string, string>();
  const byCreatedAt = [...services].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  for (const s of byCreatedAt) {
    if (s.coverPhotoId && !covers.has(s.categoryId)) {
      covers.set(s.categoryId, s.coverPhotoId);
    }
  }
  return covers;
}

// Услуги из завершённых визитов без повторов, сначала последние. lastMasterId/lastVisitAt — по
// самому позднему визиту этой услуги. Услуги вне availableServiceIds (удалённые/недоступные
// для записи) отбрасываются.
export function clientServiceHistory(
  completedVisits: CompletedVisit[],
  availableServiceIds: ReadonlySet<string>,
): ClientServiceEntry[] {
  const latest = new Map<string, ClientServiceEntry>();
  for (const v of completedVisits) {
    if (!availableServiceIds.has(v.serviceId)) continue;
    const known = latest.get(v.serviceId);
    if (!known || v.startTime > known.lastVisitAt) {
      latest.set(v.serviceId, {
        serviceId: v.serviceId,
        lastMasterId: v.masterId,
        lastVisitAt: v.startTime,
      });
    }
  }
  return [...latest.values()].sort(
    (a, b) => b.lastVisitAt.getTime() - a.lastVisitAt.getTime(),
  );
}
