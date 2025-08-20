import request from 'supertest';
import { createTestApp } from '../app.test-only.js';

export function appWithAgent() {
  const app = createTestApp();
  const agent = request.agent(app);
  return { app, agent };
}

export function xhr(headers = {}) {
  return { 'X-Requested-With': 'XMLHttpRequest', ...headers };
}
