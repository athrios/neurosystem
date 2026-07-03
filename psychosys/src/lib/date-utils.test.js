import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKeyInTimeZone } from './date-utils.js';

test('mantém a data de São Paulo quando o UTC já avançou para o dia seguinte', () => {
  const nearUtcMidnight = new Date('2026-07-03T01:30:00.000Z');
  assert.equal(
    dateKeyInTimeZone(nearUtcMidnight, 'America/Sao_Paulo'),
    '2026-07-02'
  );
});

test('avança a data somente quando também virou o dia em São Paulo', () => {
  const afterLocalMidnight = new Date('2026-07-03T03:30:00.000Z');
  assert.equal(
    dateKeyInTimeZone(afterLocalMidnight, 'America/Sao_Paulo'),
    '2026-07-03'
  );
});

