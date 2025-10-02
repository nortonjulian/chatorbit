import pino from 'pino';

const redact = {
  paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', 'password'],
  censor: '[REDACTED]',
};

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact,
  base: { service: 'chatforia-server', env: process.env.NODE_ENV },
  transport: process.env.NODE_ENV === 'production'
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
});

export default logger;
