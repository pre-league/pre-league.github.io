import test from 'node:test';
import assert from 'node:assert/strict';
import { standingPlace } from '../src/model.mjs';

test('League A awards the trophy at first and relegates only the last two', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(rank => standingPlace('A', rank, 5)), ['trophy', null, null, 'relegation', 'relegation']);
});

test('middle divisions promote the top two and relegate the bottom two', () => {
  for (const division of ['B', 'C']) {
    assert.deepEqual([1, 2, 3, 4, 5].map(rank => standingPlace(division, rank, 5)), ['promotion', 'promotion', null, 'relegation', 'relegation']);
  }
});

test('League D promotes the top two and has no relegation', () => {
  assert.deepEqual([1, 2, 3, 4].map(rank => standingPlace('D', rank, 4)), ['promotion', 'promotion', null, null]);
});
