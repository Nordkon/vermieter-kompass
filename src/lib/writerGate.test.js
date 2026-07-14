import assert from 'node:assert/strict';
import test from 'node:test';

import { transactionWriterAvailability, updateWriterOwner } from './writerGate.js';

test('Reverse-One-writer blockiert den Buchungseditor bei einem bestehenden Altentwurf', () => {
  const owner = updateWriterOwner(null, {
    id: 'contact-edit-1',
    label: 'Kontaktakte bearbeiten',
    focusId: 'contact-record-editor-trigger',
    active: true,
    dirty: true,
  });
  const result = transactionWriterAvailability({ externalWriter: owner });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'writer-active');
  assert.equal(result.blockedBy.id, 'contact-edit-1');
  assert.equal(result.blockedBy.dirty, true);
});

test('Nur der registrierte Writer darf seinen Besitz wieder freigeben', () => {
  const owner = updateWriterOwner(null, { id: 'tenancy-create', active: true });
  assert.equal(updateWriterOwner(owner, { id: 'other', active: false }), owner);
  assert.equal(updateWriterOwner(owner, { id: 'tenancy-create', active: false }), null);
});

test('Blockierendes Altmodal und freier Zustand werden unterschieden', () => {
  assert.deepEqual(transactionWriterAvailability({ blockingModal: true }), { ok: false, reason: 'modal-active' });
  assert.deepEqual(transactionWriterAvailability(), { ok: true });
});
