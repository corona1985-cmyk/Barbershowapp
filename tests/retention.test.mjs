import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const retention = require('../functions/lib/retention.js');

describe('retención de logs', () => {
  it('marca timestamps viejos y deja pasar los recientes', () => {
    const now = Date.parse('2026-09-14T00:00:00.000Z');
    const old = new Date(now - 200 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(retention.shouldPruneTimestamp(old, retention.AUDIT_MAX_AGE_MS, now), true);
    assert.equal(retention.shouldPruneTimestamp(recent, retention.AUDIT_MAX_AGE_MS, now), false);
    assert.equal(retention.shouldPruneTimestamp('no-es-fecha', retention.AUDIT_MAX_AGE_MS, now), false);
  });
});
