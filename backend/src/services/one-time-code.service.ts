import {
  createHmac,
  randomInt,
} from 'node:crypto';

import {
  env,
} from '../config/env.js';

export const generateFourDigitCode = (): string =>
  String(randomInt(0, 10000)).padStart(4, '0');

export const hashUserCode = (
  userId: string,
  code: string
): string =>
  createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`${userId}:${code}`)
    .digest('hex');