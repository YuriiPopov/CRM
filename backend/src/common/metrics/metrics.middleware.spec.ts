import { EventEmitter } from 'events';
import type { NextFunction, Request, Response } from 'express';
import { Counter, Histogram } from 'prom-client';
import { MetricsMiddleware, UNMATCHED_ROUTE } from './metrics.middleware';

describe('MetricsMiddleware', () => {
  let counter: { inc: jest.Mock };
  let histogram: { observe: jest.Mock };
  let middleware: MetricsMiddleware;

  beforeEach(() => {
    counter = { inc: jest.fn() };
    histogram = { observe: jest.fn() };
    middleware = new MetricsMiddleware(
      counter as unknown as Counter<string>,
      histogram as unknown as Histogram<string>,
    );
  });

  // Прогоняет запрос через middleware и завершает ответ с указанными статусом/маршрутом —
  // так же, как это делает Express после guard'а, обработчика или фильтра исключений.
  function run(statusCode: number, routePath?: string) {
    const req = { method: 'GET', route: undefined } as unknown as Request;
    const res = Object.assign(new EventEmitter(), { statusCode });
    const next: NextFunction = jest.fn();

    middleware.use(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
    expect(counter.inc).not.toHaveBeenCalled(); // пишем только по завершении ответа

    if (routePath) {
      (req as { route?: { path: string } }).route = { path: routePath };
    }
    res.statusCode = statusCode;
    res.emit('finish');
  }

  it('records a request rejected before the handler (e.g. 401 from a guard)', () => {
    run(401, '/client/me');

    const labels = { method: 'GET', path: '/client/me', status_code: '401' };
    expect(counter.inc).toHaveBeenCalledWith(labels);
    expect(histogram.observe).toHaveBeenCalledWith(labels, expect.any(Number));
  });

  it('records server errors', () => {
    run(500, '/client/bookings/:id/cancel');

    expect(counter.inc).toHaveBeenCalledWith({
      method: 'GET',
      path: '/client/bookings/:id/cancel',
      status_code: '500',
    });
  });

  it('groups requests without a matched route under one label', () => {
    run(404);

    expect(counter.inc).toHaveBeenCalledWith({
      method: 'GET',
      path: UNMATCHED_ROUTE,
      status_code: '404',
    });
  });
});
