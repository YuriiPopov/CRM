import { WinstonModule, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

const { combine, timestamp, json, errors, colorize, printf } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf((info) => {
    const { level, message, timestamp, context, trace, ...meta } = info as {
      level: string;
      message: unknown;
      timestamp: string;
      context?: string;
      trace?: string;
      [key: string]: unknown;
    };
    const metaStr = Object.keys(meta).length
      ? `\n${JSON.stringify(meta, null, 2)}`
      : '';
    const contextStr = context ?? 'App';
    const messageStr =
      typeof message === 'string' ? message : JSON.stringify(message);
    return `${timestamp} [${contextStr}] ${level}: ${messageStr}${trace ? `\n${trace}` : ''}${metaStr}`;
  }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

// Переиспользуемые опции: для forRoot() в AppModule и createLogger() в main.ts
export const winstonOptions: WinstonModuleOptions = {
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    }),
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: '/var/log/b4u-crm/app.log',
            format: prodFormat,
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: '/var/log/b4u-crm/error.log',
            level: 'error',
            format: prodFormat,
          }),
        ]
      : []),
  ],
};

// Используется в main.ts как logger при создании приложения
export const loggerConfig = WinstonModule.createLogger(winstonOptions);
