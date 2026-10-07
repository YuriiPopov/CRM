import {
  categoryCoverPhotoIds,
  clientServiceHistory,
  CompletedVisit,
} from './client-catalog.util';

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

describe('categoryCoverPhotoIds', () => {
  it('takes the cover of the oldest service that has a photo', () => {
    const covers = categoryCoverPhotoIds([
      { categoryId: 'c1', createdAt: day(3), coverPhotoId: 'late' },
      { categoryId: 'c1', createdAt: day(1), coverPhotoId: null },
      { categoryId: 'c1', createdAt: day(2), coverPhotoId: 'first-with-photo' },
    ]);
    expect(covers.get('c1')).toBe('first-with-photo');
  });

  it('omits categories where no service has a photo', () => {
    const covers = categoryCoverPhotoIds([
      { categoryId: 'c1', createdAt: day(1), coverPhotoId: null },
      { categoryId: 'c2', createdAt: day(1), coverPhotoId: 'p2' },
    ]);
    expect(covers.has('c1')).toBe(false);
    expect(covers.get('c2')).toBe('p2');
  });
});

describe('clientServiceHistory', () => {
  const all = new Set(['s1', 's2', 's3']);

  it('dedupes by service, keeps the latest visit and sorts latest first', () => {
    const visits: CompletedVisit[] = [
      { serviceId: 's1', masterId: 'm-old', startTime: day(1) },
      { serviceId: 's2', masterId: 'm2', startTime: day(5) },
      { serviceId: 's1', masterId: 'm-new', startTime: day(9) },
    ];
    expect(clientServiceHistory(visits, all)).toEqual([
      { serviceId: 's1', lastMasterId: 'm-new', lastVisitAt: day(9) },
      { serviceId: 's2', lastMasterId: 'm2', lastVisitAt: day(5) },
    ]);
  });

  it('drops services that are no longer available', () => {
    const visits: CompletedVisit[] = [
      { serviceId: 'gone', masterId: 'm1', startTime: day(9) },
      { serviceId: 's1', masterId: 'm1', startTime: day(1) },
    ];
    expect(clientServiceHistory(visits, all).map((e) => e.serviceId)).toEqual([
      's1',
    ]);
  });

  it('returns an empty list for no visits', () => {
    expect(clientServiceHistory([], all)).toEqual([]);
  });
});
