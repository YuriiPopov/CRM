import { ExecutionContext, HttpException } from '@nestjs/common';
import {
  assertMinClientApi,
  ClientApiGuard,
  minClientApi,
} from './client-api.guard';

function contextFor(
  path: string,
  headers: Record<string, string | string[]> = {},
  method = 'GET',
): ExecutionContext {
  const req = { path, url: path, method, headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('ClientApiGuard', () => {
  const guard = new ClientApiGuard();
  const original = process.env.MIN_CLIENT_API;

  afterEach(() => {
    if (original === undefined) delete process.env.MIN_CLIENT_API;
    else process.env.MIN_CLIENT_API = original;
  });

  function thrown(ctx: ExecutionContext): HttpException {
    try {
      guard.canActivate(ctx);
    } catch (e) {
      return e as HttpException;
    }
    throw new Error('expected the guard to reject');
  }

  it('lets everything through when the threshold is unset', () => {
    delete process.env.MIN_CLIENT_API;
    expect(guard.canActivate(contextFor('/bookings'))).toBe(true);
  });

  it('lets a request without the header through when the threshold is 0', () => {
    process.env.MIN_CLIENT_API = '0';
    expect(guard.canActivate(contextFor('/bookings'))).toBe(true);
  });

  it('responds 426 CLIENT_UPDATE_REQUIRED without the header at threshold 2', () => {
    process.env.MIN_CLIENT_API = '2';
    const error = thrown(contextFor('/bookings'));
    expect(error.getStatus()).toBe(426);
    expect(error.getResponse()).toMatchObject({
      statusCode: 426,
      code: 'CLIENT_UPDATE_REQUIRED',
      message: expect.any(String) as string,
    });
  });

  it('responds 426 for a lower or malformed version', () => {
    process.env.MIN_CLIENT_API = '2';
    expect(
      thrown(contextFor('/bookings', { 'x-client-api': '1' })).getStatus(),
    ).toBe(426);
    expect(
      thrown(contextFor('/bookings', { 'x-client-api': 'abc' })).getStatus(),
    ).toBe(426);
    expect(
      thrown(contextFor('/bookings', { 'x-client-api': '' })).getStatus(),
    ).toBe(426);
  });

  it('treats non-decimal or padded versions as version 0', () => {
    process.env.MIN_CLIENT_API = '2';
    for (const value of ['0x2', '2e0', '', ' 2', '2 ', ' 2 ', '+2', '2.0']) {
      expect(
        thrown(contextFor('/bookings', { 'x-client-api': value })).getStatus(),
      ).toBe(426);
    }
  });

  it('lets version 2 and higher through at threshold 2', () => {
    process.env.MIN_CLIENT_API = '2';
    expect(
      guard.canActivate(contextFor('/bookings', { 'x-client-api': '2' })),
    ).toBe(true);
    expect(
      guard.canActivate(contextFor('/auth/login', { 'x-client-api': '3' })),
    ).toBe(true);
  });

  it('never checks health, metrics, the root, public routes and preflight', () => {
    process.env.MIN_CLIENT_API = '2';
    for (const path of ['/', '/health', '/metrics', '/public/booking/slots']) {
      expect(guard.canActivate(contextFor(path))).toBe(true);
    }
    expect(guard.canActivate(contextFor('/bookings', {}, 'OPTIONS'))).toBe(
      true,
    );
  });

  it('matches exempt paths case-insensitively', () => {
    process.env.MIN_CLIENT_API = '2';
    for (const path of ['/Health', '/HEALTH/', '/Metrics', '/PUBLIC/x']) {
      expect(guard.canActivate(contextFor(path))).toBe(true);
    }
  });

  it('does not exempt paths that merely start like a public one', () => {
    process.env.MIN_CLIENT_API = '2';
    expect(thrown(contextFor('/publication')).getStatus()).toBe(426);
    expect(thrown(contextFor('/client/bookings')).getStatus()).toBe(426);
  });

  it('refuses to be created with a malformed MIN_CLIENT_API', () => {
    for (const value of ['abc', '-1', '1.5']) {
      process.env.MIN_CLIENT_API = value;
      expect(() => new ClientApiGuard()).toThrow(/MIN_CLIENT_API/);
    }
    process.env.MIN_CLIENT_API = '2';
    expect(() => new ClientApiGuard()).not.toThrow();
  });

  it('validates the env value at startup', () => {
    expect(minClientApi({})).toBe(0);
    expect(() => assertMinClientApi({ MIN_CLIENT_API: '2' })).not.toThrow();
    expect(() => assertMinClientApi({ MIN_CLIENT_API: 'two' })).toThrow(
      /MIN_CLIENT_API/,
    );
    expect(() => assertMinClientApi({ MIN_CLIENT_API: '-1' })).toThrow(
      /MIN_CLIENT_API/,
    );
    expect(() => assertMinClientApi({ MIN_CLIENT_API: '1.5' })).toThrow(
      /MIN_CLIENT_API/,
    );
  });
});
