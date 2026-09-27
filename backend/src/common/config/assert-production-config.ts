// Дефолт, с которым модули auth/client-portal подписывают JWT, если JWT_SECRET не задан — удобно
// для локальной разработки, но в production это значит, что любой может подделать токен.
export const DEFAULT_JWT_SECRET = 'change-me-in-production';

/**
 * Отказывается запускать приложение в production с небезопасной конфигурацией — лучше упасть на
 * старте с понятной ошибкой, чем молча подписывать токены известным всем секретом.
 */
export function assertProductionConfig(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'production') return;

  const problems: string[] = [];
  if (!env.JWT_SECRET || env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    problems.push('JWT_SECRET must be set to a non-default value');
  }
  if (env.CLIENT_OTP_DEV_MODE === 'true') {
    // Режим возвращает SMS-код в ответе API — в production это обход проверки телефона
    problems.push('CLIENT_OTP_DEV_MODE must not be enabled');
  }

  if (problems.length > 0) {
    throw new Error(`Unsafe production configuration: ${problems.join('; ')}`);
  }
}
