export const WORKSPACE_MODES = Object.freeze(['preview', 'editor']);
export const WORKSPACE_DOCKS = Object.freeze(['floating', 'left', 'center', 'right']);
export const WORKSPACE_SIZES = Object.freeze(['preview', 'compact', 'standard']);

export const WORKSPACE_SIZE_PRESETS = Object.freeze({
  preview: Object.freeze({ width: 480, height: 420 }),
  compact: Object.freeze({ width: 520, height: 480 }),
  standard: Object.freeze({ width: 640, height: 560 }),
});

const asArray = (value) => (Array.isArray(value) ? value : []);
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const stateWithWindows = (windows, activeWindowId = null) => ({
  windows,
  editor: windows.find((window) => window.mode === 'editor') || null,
  preview: [...windows].reverse().find((window) => window.mode === 'preview') || null,
  activeWindowId,
});

export function createWorkspaceWindow(input = {}) {
  const mode = oneOf(input.mode, WORKSPACE_MODES, 'preview');
  const allowedSizes = mode === 'editor' ? ['compact', 'standard'] : ['preview'];
  const size = oneOf(input.size, allowedSizes, mode === 'editor' ? 'standard' : 'preview');
  const preset = WORKSPACE_SIZE_PRESETS[size];
  return {
    id: String(input.id || ''),
    title: String(input.title || 'Arbeitsfenster'),
    entityType: String(input.entityType || ''),
    entityId: String(input.entityId || ''),
    mode,
    dirty: mode === 'editor' && input.dirty === true,
    minimized: input.minimized === true,
    dock: oneOf(input.dock, WORKSPACE_DOCKS, 'floating'),
    size,
    rect: {
      x: finite(input.rect?.x, 32),
      y: finite(input.rect?.y, 96),
      width: Math.max(320, finite(input.rect?.width, preset.width)),
      height: Math.max(240, finite(input.rect?.height, preset.height)),
    },
    payload: mode === 'editor' ? {
      status: input.payload?.status || 'open',
      draft: input.payload?.draft ?? null,
      file: input.payload?.file ?? null,
      manualAmounts: input.payload?.manualAmounts || {},
      error: input.payload?.error || '',
      ...(input.payload || {}),
    } : (input.payload || null),
  };
}

export function createWorkspaceState(windows = []) {
  const candidates = asArray(windows).map(createWorkspaceWindow);
  const editor = candidates.find((window) => window.mode === 'editor');
  const preview = [...candidates].reverse().find((window) => window.mode === 'preview');
  const normalized = candidates.filter((window) => window === editor || window === preview);
  return stateWithWindows(
    normalized,
    [...normalized].reverse().find((window) => !window.minimized)?.id || null,
  );
}

export function workspaceEditor(state) {
  return asArray(state?.windows).find((window) => window.mode === 'editor') || null;
}

export function openWorkspaceWindow(state, input) {
  const current = state || createWorkspaceState();
  const candidate = createWorkspaceWindow(input);
  const existing = current.windows.find((window) => window.id === candidate.id);
  if (existing) {
    const windows = current.windows.map((window) => (
      window.id === candidate.id ? { ...window, minimized: false } : window
    ));
    return { ok: true, state: stateWithWindows(windows, candidate.id), windowId: candidate.id };
  }

  const editor = workspaceEditor(current);
  if (candidate.mode === 'editor' && editor) {
    return { ok: false, state: current, reason: 'editor-active', blockedBy: editor.id };
  }

  const retainedWindows = candidate.mode === 'preview'
    ? current.windows.filter((window) => window.mode !== 'preview')
    : current.windows;
  return {
    ok: true,
    state: stateWithWindows([...retainedWindows, candidate], candidate.id),
    windowId: candidate.id,
  };
}

export function requestWorkspaceMode(state, windowId, mode) {
  if (!WORKSPACE_MODES.includes(mode)) {
    return { ok: false, state, reason: 'invalid-mode' };
  }
  const target = asArray(state?.windows).find((window) => window.id === windowId);
  if (!target) return { ok: false, state, reason: 'not-found' };
  const editor = workspaceEditor(state);
  if (mode === 'editor' && editor && editor.id !== windowId) {
    return { ok: false, state, reason: 'editor-active', blockedBy: editor.id };
  }
  let windows = state.windows.map((window) => (
    window.id === windowId
      ? {
        ...window,
        mode,
        size: mode === 'editor' ? (window.size === 'compact' ? 'compact' : 'standard') : 'preview',
        dirty: mode === 'editor' ? window.dirty : false,
      }
      : window
  ));
  if (mode === 'preview') windows = windows.filter((window) => window.id === windowId || window.mode !== 'preview');
  return { ok: true, state: stateWithWindows(windows, windowId) };
}

export function setWorkspaceDirty(state, windowId, dirty) {
  const windows = asArray(state?.windows).map((window) => (
      window.id === windowId && window.mode === 'editor'
        ? { ...window, dirty: dirty === true }
        : window
    ));
  return stateWithWindows(windows, state?.activeWindowId || null);
}

export function updateWorkspacePayload(state, windowId, patch) {
  const windows = asArray(state?.windows).map((window) => (
      window.id === windowId && window.mode === 'editor'
        ? { ...window, payload: { ...window.payload, ...(patch || {}) } }
        : window
    ));
  return stateWithWindows(windows, state?.activeWindowId || null);
}

export function minimizeWorkspaceWindow(state, windowId) {
  const windows = asArray(state?.windows).map((window) => (
    window.id === windowId ? { ...window, minimized: true } : window
  ));
  const activeWindowId = [...windows].reverse().find((window) => !window.minimized)?.id || null;
  return stateWithWindows(windows, activeWindowId);
}

export function restoreWorkspaceWindow(state, windowId) {
  const windows = asArray(state?.windows).map((window) => (
      window.id === windowId ? { ...window, minimized: false } : window
    ));
  return stateWithWindows(windows, windowId);
}

export function closeWorkspaceWindow(state, windowId, { discardDirty = false } = {}) {
  const target = asArray(state?.windows).find((window) => window.id === windowId);
  if (!target) return { ok: false, state, reason: 'not-found' };
  if (target.dirty && !discardDirty) {
    return { ok: false, state, reason: 'dirty', blockedBy: windowId };
  }
  const windows = state.windows.filter((window) => window.id !== windowId);
  const activeWindowId = state.activeWindowId === windowId
    ? [...windows].reverse().find((window) => !window.minimized)?.id || null
    : state.activeWindowId;
  return { ok: true, state: stateWithWindows(windows, activeWindowId) };
}

export function setWorkspacePlacement(state, windowId, placement = {}) {
  const windows = asArray(state?.windows).map((window) => {
      if (window.id !== windowId) return window;
      const allowedSizes = window.mode === 'editor' ? ['compact', 'standard'] : ['preview'];
      const size = oneOf(placement.size, allowedSizes, window.size);
      const preset = WORKSPACE_SIZE_PRESETS[size];
      return {
        ...window,
        dock: oneOf(placement.dock, WORKSPACE_DOCKS, window.dock),
        size,
        rect: {
          ...window.rect,
          ...(placement.rect || {}),
          width: finite(placement.rect?.width, placement.size ? preset.width : window.rect.width),
          height: finite(placement.rect?.height, placement.size ? preset.height : window.rect.height),
        },
      };
    });
  return stateWithWindows(windows, state?.activeWindowId || null);
}

export function clampWindowRect(rect, viewport, { margin = 12 } = {}) {
  const viewportWidth = Math.max(0, finite(viewport?.width, 0));
  const viewportHeight = Math.max(0, finite(viewport?.height, 0));
  const availableWidth = Math.max(0, viewportWidth - margin * 2);
  const availableHeight = Math.max(0, viewportHeight - margin * 2);
  const width = Math.min(Math.max(320, finite(rect?.width, 720)), availableWidth || 320);
  const height = Math.min(Math.max(240, finite(rect?.height, 720)), availableHeight || 240);
  const minX = margin;
  const maxX = Math.max(minX, viewportWidth - margin - width);
  const minY = margin;
  const maxY = Math.max(minY, viewportHeight - margin - height);
  return {
    x: Math.min(maxX, Math.max(minX, finite(rect?.x, minX))),
    y: Math.min(maxY, Math.max(minY, finite(rect?.y, minY))),
    width,
    height,
  };
}

export function workspaceResponsiveMode(viewportWidth) {
  const width = finite(viewportWidth, 0);
  if (width <= 760) return 'mobile';
  if (width < 1180) return 'compact';
  return 'desktop';
}
