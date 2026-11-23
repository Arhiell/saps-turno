import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newsScheduleError } from '../src/validators/news-schedule.js';

const now = Date.parse('2026-10-07T16:14:00-03:00');
const base = { estado: 'PUBLICADA', fecha_publicacion: null, fecha_finalizacion: null };
test('rejects yesterday, earlier times and the current instant', () => {
  for (const date of ['2026-10-06T17:00:00-03:00', '2026-10-07T16:13:00-03:00', '2026-10-07T19:14:00Z']) {
    assert.ok(newsScheduleError({ ...base, fecha_publicacion: date }, null, now));
    assert.ok(newsScheduleError({ ...base, fecha_finalizacion: date }, null, now));
  }
});
test('accepts immediate publication or a future schedule', () => {
  assert.equal(newsScheduleError(base, null, now), null);
  assert.equal(newsScheduleError({ ...base, fecha_publicacion: '2026-10-07T16:15:00-03:00', fecha_finalizacion: '2026-10-07T16:16:00-03:00' }, null, now), null);
});
test('end must follow publication', () => {
  assert.ok(newsScheduleError({ ...base, fecha_publicacion: '2026-10-08T16:00:00-03:00', fecha_finalizacion: '2026-10-08T15:00:00-03:00' }, null, now));
});
test('preserves historical dates on edits but rejects backdating and stale draft publication', () => {
  const old = { ...base, fecha_publicacion: '2026-10-06T16:00:00-03:00', fecha_finalizacion: '2026-10-06T18:00:00-03:00' };
  assert.equal(newsScheduleError(old, old, now), null);
  assert.ok(newsScheduleError({ ...old, fecha_publicacion: '2026-10-05T16:00:00-03:00' }, old, now));
  assert.ok(newsScheduleError(old, { ...old, estado: 'BORRADOR' }, now));
});
