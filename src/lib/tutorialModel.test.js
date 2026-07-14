import test from 'node:test';
import assert from 'node:assert/strict';

import {
  belongsToTutorial,
  buildTutorialCleanupPlan,
  finishTutorialStep,
  startTutorialProgress,
  tutorialProgressPercent,
} from './tutorialModel.js';

test('Tutorialfortschritt startet separat, bleibt deterministisch und endet bei 100 Prozent', () => {
  let progress = startTutorialProgress('tutorial-1', '2026-07-14T10:00:00.000Z');
  assert.equal(progress.status, 'active');
  assert.equal(progress.stepIndex, 0);
  assert.equal(tutorialProgressPercent(progress), 0);

  progress = finishTutorialStep(progress, 'welcome');
  assert.equal(progress.stepIndex, 1);
  assert.deepEqual(progress.completed, ['welcome']);

  progress = finishTutorialStep(progress, 'property', true);
  assert.deepEqual(progress.skipped, ['property']);
});

test('Tutorialdaten werden ausschließlich über die Sitzungs-ID erkannt', () => {
  assert.equal(belongsToTutorial({ tutorialSessionId: 'tutorial-1' }, 'tutorial-1'), true);
  assert.equal(belongsToTutorial({ tutorialSessionId: 'tutorial-2' }, 'tutorial-1'), false);
  assert.equal(belongsToTutorial({ name: 'Tutorial Haus' }, 'tutorial-1'), false);
});

test('Aufräumplan nutzt IDs statt Namen und bewahrt gleichnamige Nutzerdaten', () => {
  const plan = buildTutorialCleanupPlan({
    properties: [
      { id: 'real', name: 'Testhaus' },
      { id: 'practice', name: 'Testhaus', tutorialSessionId: 'tutorial-1' },
    ],
    units: [
      { id: 'real-unit', propertyId: 'real' },
      { id: 'practice-unit', propertyId: 'practice' },
    ],
    contacts: [
      { id: 'real-contact', name: 'Alex' },
      { id: 'practice-contact', name: 'Alex', tutorialSessionId: 'tutorial-1' },
    ],
    tenancies: [{ id: 'practice-tenancy', tutorialSessionId: 'tutorial-1' }],
    transactions: [
      { id: 'real-booking', propertyId: 'real' },
      { id: 'practice-booking', propertyId: 'practice' },
    ],
  }, 'tutorial-1');
  assert.deepEqual(plan.propertyIds, ['practice']);
  assert.deepEqual(plan.unitIds, ['practice-unit']);
  assert.deepEqual(plan.contactIds, ['practice-contact']);
  assert.deepEqual(plan.tenancyIds, ['practice-tenancy']);
  assert.deepEqual(plan.transactionIds, ['practice-booking']);
});
