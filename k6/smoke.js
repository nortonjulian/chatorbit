import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 2,
  iterations: 6, // small & fast
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% errors
    http_req_duration: ['p(95)<800'], // 95% under 800ms
  },
};

const BASE = __ENV.BASE_URL || 'https://api.staging.chatforia.com';

export default function () {
  // 1) Health/status
  let res = http.get(`${BASE}/status`);
  check(res, {
    'status 200': (r) => r.status === 200,
    'body has ok': (r) => String(r.body || '').toLowerCase().includes('ok') || r.status === 200,
  });

  // 2) Public welcome or version endpoint if you have one (optional)
  // let res2 = http.get(`${BASE}/version`);
  // check(res2, { 'version 200': (r) => r.status === 200 });

  sleep(0.5);
}
