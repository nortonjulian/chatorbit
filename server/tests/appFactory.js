import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';

import authRouter from '../routes/auth.js';
import usersRouter from '../routes/users.js';
import chatroomsRouter from '../routes/chatrooms.js';  // <-- add this
import messagesRouter from '../routes/messages.js';    // <-- if your tests hit /messages
import { notFoundHandler, errorHandler } from '../middleware/errorHandler.js';

export default async function appFactory() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/chatrooms', chatroomsRouter);  // <-- mount it
  app.use('/messages', messagesRouter);    // <-- mount if used by tests

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
