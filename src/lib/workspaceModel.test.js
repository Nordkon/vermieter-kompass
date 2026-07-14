import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampWindowRect,
  closeWorkspaceWindow,
  createWorkspaceState,
  createWorkspaceWindow,
  minimizeWorkspaceWindow,
  openWorkspaceWindow,
  requestWorkspaceMode,
  restoreWorkspaceWindow,
  setWorkspaceDirty,
  setWorkspacePlacement,
  updateWorkspacePayload,
  workspaceResponsiveMode,
} from './workspaceModel.js';

test('Arbeitsfenster trennt Vorschau und Editor samt Dirty-Zustand', () => {
  const preview = createWorkspaceWindow({ id: 'preview', mode: 'preview', dirty: true });
  const editor = createWorkspaceWindow({ id: 'editor', mode: 'editor', dirty: true });
  assert.equal(preview.dirty, false);
  assert.equal(editor.dirty, true);
  const state = setWorkspaceDirty(createWorkspaceState([editor]), 'editor', false);
  assert.equal(state.windows[0].dirty, false);
  assert.equal(state.editor.id, 'editor');
  assert.equal(state.preview, null);
});

test('Minimieren und Wiederherstellen bewahren Editor und Entwurfsmarkierung', () => {
  const original = createWorkspaceState([{ id: 'editor', mode: 'editor', dirty: true }]);
  const minimized = minimizeWorkspaceWindow(original, 'editor');
  assert.equal(minimized.windows[0].minimized, true);
  assert.equal(minimized.windows[0].dirty, true);
  const restored = restoreWorkspaceWindow(minimized, 'editor');
  assert.equal(restored.activeWindowId, 'editor');
  assert.equal(restored.windows[0].minimized, false);
  assert.equal(restored.windows[0].dirty, true);
});

test('One-writer-Gate erlaubt nur einen Editor und ersetzt eine bestehende Vorschau', () => {
  let state = createWorkspaceState();
  ({ state } = openWorkspaceWindow(state, { id: 'preview-a', mode: 'preview' }));
  ({ state } = openWorkspaceWindow(state, { id: 'editor-a', mode: 'editor' }));
  const blocked = openWorkspaceWindow(state, { id: 'editor-b', mode: 'editor' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'editor-active');
  assert.equal(blocked.blockedBy, 'editor-a');
  const replaced = openWorkspaceWindow(state, { id: 'preview-b', mode: 'preview' });
  assert.equal(replaced.ok, true);
  assert.deepEqual(replaced.state.windows.map((window) => window.id), ['editor-a', 'preview-b']);
  assert.equal(replaced.state.editor.id, 'editor-a');
  assert.equal(replaced.state.preview.id, 'preview-b');
  assert.equal(requestWorkspaceMode(state, 'preview-a', 'editor').ok, false);
});

test('Auch initialer Zustand und Moduswechsel bewahren höchstens eine Vorschau', () => {
  let state = createWorkspaceState([
    { id: 'preview-old', mode: 'preview' },
    { id: 'preview-new', mode: 'preview' },
    { id: 'editor', mode: 'editor' },
  ]);
  assert.deepEqual(state.windows.map((window) => window.id), ['preview-new', 'editor']);
  ({ state } = requestWorkspaceMode(state, 'editor', 'preview'));
  assert.deepEqual(state.windows.map((window) => window.id), ['editor']);
});

test('Dirty Editor verlangt vor dem Schließen explizites Verwerfen', () => {
  const state = createWorkspaceState([{ id: 'editor', mode: 'editor', dirty: true }]);
  assert.equal(closeWorkspaceWindow(state, 'editor').reason, 'dirty');
  assert.equal(closeWorkspaceWindow(state, 'editor', { discardDirty: true }).state.windows.length, 0);
});

test('Dock und feste Größe werden nur aus erlaubten Werten übernommen', () => {
  const state = createWorkspaceState([{ id: 'window', mode: 'editor', size: 'compact', dock: 'left' }]);
  const placed = setWorkspacePlacement(state, 'window', { size: 'standard', dock: 'center' });
  assert.equal(placed.windows[0].size, 'standard');
  assert.equal(placed.windows[0].dock, 'center');
  assert.equal(placed.windows[0].rect.width, 640);
  assert.equal(placed.windows[0].rect.height, 560);
  const invalid = setWorkspacePlacement(placed, 'window', { size: 'gigantic', dock: 'bottom' });
  assert.equal(invalid.windows[0].size, 'standard');
  assert.equal(invalid.windows[0].dock, 'center');
});

test('Viewport-Clamp hält Kopf und Fenster innerhalb kleiner Ansichten', () => {
  assert.deepEqual(clampWindowRect(
    { x: 1800, y: -100, width: 1000, height: 900 },
    { width: 800, height: 600 },
  ), { x: 12, y: 12, width: 776, height: 576 });
});

test('Editorpayload überlebt Minimieren, Wiederherstellen und Platzierung verlustfrei', () => {
  const file = { name: 'beleg.pdf', size: 1200 };
  let state = createWorkspaceState([{
    id: 'editor',
    mode: 'editor',
    payload: {
      status: 'error',
      draft: { description: 'Entwurf' },
      file,
      manualAmounts: { u1: '20.00' },
      error: 'Noch prüfen',
    },
  }]);
  state = minimizeWorkspaceWindow(state, 'editor');
  state = setWorkspacePlacement(state, 'editor', { dock: 'right', size: 'compact' });
  state = restoreWorkspaceWindow(state, 'editor');
  assert.equal(state.windows[0].payload.file, file);
  assert.deepEqual(state.windows[0].payload.draft, { description: 'Entwurf' });
  assert.deepEqual(state.windows[0].payload.manualAmounts, { u1: '20.00' });
  assert.equal(state.windows[0].payload.status, 'error');
  assert.equal(state.windows[0].payload.error, 'Noch prüfen');
  state = updateWorkspacePayload(state, 'editor', { status: 'open' });
  assert.equal(state.windows[0].payload.status, 'open');
  assert.equal(state.windows[0].payload.file, file);
});

test('Responsive Modus hat feste mobile, kompakte und Desktop-Grenzen', () => {
  assert.equal(workspaceResponsiveMode(759), 'mobile');
  assert.equal(workspaceResponsiveMode(760), 'mobile');
  assert.equal(workspaceResponsiveMode(761), 'compact');
  assert.equal(workspaceResponsiveMode(1179), 'compact');
  assert.equal(workspaceResponsiveMode(1180), 'desktop');
});
