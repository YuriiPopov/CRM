import {
  assertProductionConfig,
  DEFAULT_JWT_SECRET,
} from './assert-production-config';

describe('assertProductionConfig', () => {
  it('does not check anything outside production', () => {
    expect(() =>
      assertProductionConfig({ NODE_ENV: 'development' }),
    ).not.toThrow();
    expect(() => assertProductionConfig({})).not.toThrow();
  });

  it('rejects a missing or default JWT secret in production', () => {
    expect(() => assertProductionConfig({ NODE_ENV: 'production' })).toThrow(
      /JWT_SECRET/,
    );
    expect(() =>
      assertProductionConfig({
        NODE_ENV: 'production',
        JWT_SECRET: DEFAULT_JWT_SECRET,
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('rejects the OTP dev mode in production', () => {
    expect(() =>
      assertProductionConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 's3cr3t-value',
        CLIENT_OTP_DEV_MODE: 'true',
      }),
    ).toThrow(/CLIENT_OTP_DEV_MODE/);
  });

  it('accepts a safe production configuration', () => {
    expect(() =>
      assertProductionConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 's3cr3t-value',
      }),
    ).not.toThrow();
  });
});
