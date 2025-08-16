import 'dotenv/config';
import { assertRequiredEnv } from '../utils/env.js';
assertRequiredEnv(['JWT_SECRET']);
console.log('Env OK');
