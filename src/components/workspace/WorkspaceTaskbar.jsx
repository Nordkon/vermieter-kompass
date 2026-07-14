export function WorkspaceTaskbar({ windows = [], onRestore }) {
  const minimized = (Array.isArray(windows) ? windows : []).filter((window) => window.minimized);
  if (!minimized.length) return null;

  return (
    <nav className="workspace-taskbar" aria-label="Minimierte Arbeitsfenster">
      <span className="workspace-taskbar__label">Arbeitsfenster</span>
      <div className="workspace-taskbar__items" role="toolbar" aria-label="Fenster wiederherstellen">
        {minimized.map((window) => (
          <button
            key={window.id}
            id={`workspace-task-${window.id}`}
            type="button"
            className="workspace-taskbar__item"
            onClick={() => onRestore?.(window.id)}
            aria-label={`${window.title} wiederherstellen${window.dirty ? ', ungespeicherte Änderungen' : ''}`}
          >
            <span>{window.mode === 'editor' ? 'Bearbeiten' : 'Vorschau'}</span>
            <strong>{window.title}</strong>
            {window.dirty && <i aria-hidden="true" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
