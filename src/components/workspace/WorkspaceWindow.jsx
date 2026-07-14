import { useEffect, useRef } from 'react';

import { Icon } from '../Icon.jsx';
import {
  WORKSPACE_DOCKS,
  WORKSPACE_SIZES,
  clampWindowRect,
  workspaceResponsiveMode,
} from '../../lib/workspaceModel.js';

const dockLabels = {
  floating: 'Frei',
  left: 'Links',
  center: 'Mitte',
  right: 'Rechts',
};

const sizeLabels = {
  preview: 'Vorschau',
  compact: 'Kompakt',
  standard: 'Normal',
};

const browserViewport = () => ({
  width: typeof window === 'undefined' ? 1920 : window.innerWidth,
  height: typeof window === 'undefined' ? 1080 : window.innerHeight,
});

export function WorkspaceWindow({
  id,
  title,
  subtitle = '',
  mode = 'preview',
  dirty = false,
  minimized = false,
  active = false,
  dock = 'floating',
  size = mode === 'editor' ? 'standard' : 'preview',
  rect = { x: 32, y: 96, width: 640, height: 560 },
  onActivate,
  onMinimize,
  onRequestClose,
  onRectChange,
  onDockChange,
  onSizeChange,
  discardPrompt = null,
  children,
  footer = null,
}) {
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const availableSizes = mode === 'editor' ? WORKSPACE_SIZES.filter((value) => value !== 'preview') : ['preview'];
  const titleId = `workspace-window-${id}-title`;
  const descriptionId = `workspace-window-${id}-description`;

  useEffect(() => {
    if (!active || minimized) return;
    if (rootRef.current?.contains(document.activeElement)) return;
    const focusTarget = mode === 'editor'
      ? rootRef.current?.querySelector('[autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])')
      : null;
    (focusTarget || rootRef.current)?.focus({ preventScroll: true });
  }, [active, minimized, mode]);

  if (minimized) return null;

  const moveTo = (nextRect) => onRectChange?.(clampWindowRect(nextRect, browserViewport()));

  const startDrag = (event) => {
    if (event.button !== 0 || workspaceResponsiveMode(browserViewport().width) === 'mobile') return;
    onActivate?.(id);
    const bounds = rootRef.current?.getBoundingClientRect();
    if (dock !== 'floating') onDockChange?.('floating');
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: bounds?.left ?? rect.x,
      originY: bounds?.top ?? rect.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const drag = (event) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    moveTo({
      ...rect,
      x: current.originX + event.clientX - current.startX,
      y: current.originY + event.clientY - current.startY,
    });
  };

  const endDrag = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const moveWithKeyboard = (event) => {
    if (workspaceResponsiveMode(browserViewport().width) === 'mobile' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const bounds = rootRef.current?.getBoundingClientRect();
    const baseRect = dock === 'floating' ? rect : {
      x: bounds?.left ?? rect.x,
      y: bounds?.top ?? rect.y,
      width: bounds?.width ?? rect.width,
      height: bounds?.height ?? rect.height,
    };
    if (dock !== 'floating') onDockChange?.('floating');
    const step = event.shiftKey ? 40 : 12;
    const delta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    moveTo({ ...baseRect, x: baseRect.x + delta[0], y: baseRect.y + delta[1] });
  };

  return (
    <section
      ref={rootRef}
      className={`workspace-window workspace-window--${mode} workspace-window--dock-${dock} workspace-window--size-${size}${active ? ' workspace-window--active' : ''}`}
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={subtitle ? descriptionId : undefined}
      tabIndex={-1}
      style={dock === 'floating' ? {
        '--workspace-x': `${rect.x}px`,
        '--workspace-y': `${rect.y}px`,
        '--workspace-width': `${rect.width}px`,
        '--workspace-height': `${rect.height}px`,
      } : undefined}
      onPointerDown={() => onActivate?.(id)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onRequestClose?.(id);
      }}
    >
      <header className="workspace-window__header">
        <div
          className="workspace-window__drag-handle"
          role="button"
          tabIndex={0}
          aria-label={`${title} verschieben. Ziehen oder Pfeiltasten lösen die Dockposition automatisch.`}
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={moveWithKeyboard}
        >
          <span className="workspace-window__eyebrow">{mode === 'editor' ? 'Bearbeitung' : 'Vorschau'}</span>
          <strong id={titleId}>{title}</strong>
          {subtitle && <small id={descriptionId}>{subtitle}</small>}
        </div>

        <div className="workspace-window__tools" aria-label="Fenstersteuerung">
          <label>
            <span className="tenant-area__accessible-label">Fensterposition</span>
            <select value={dock} onChange={(event) => onDockChange?.(event.target.value)} aria-label="Fensterposition">
              {WORKSPACE_DOCKS.map((value) => <option key={value} value={value}>{dockLabels[value]}</option>)}
            </select>
          </label>
          <label className={mode === 'preview' ? 'workspace-window__preview-size' : undefined}>
            <span className="tenant-area__accessible-label">Fenstergröße</span>
            <select value={size} onChange={(event) => onSizeChange?.(event.target.value)} aria-label="Fenstergröße">
              {availableSizes.map((value) => <option key={value} value={value}>{sizeLabels[value]}</option>)}
            </select>
          </label>
          {dirty && <span className="workspace-window__dirty" role="status">Ungespeichert</span>}
          <button type="button" className="icon-button" aria-label={`${title} minimieren`} onClick={() => onMinimize?.(id)}>
            <Icon name="minus" size={17} />
          </button>
          <button type="button" className="icon-button" aria-label={`${title} schließen`} onClick={() => onRequestClose?.(id)}>
            <Icon name="close" size={17} />
          </button>
        </div>
      </header>

      {discardPrompt && <div className="workspace-window__discard" role="alert">{discardPrompt}</div>}
      <div className="workspace-window__body">{children}</div>
      {footer && <footer className="workspace-window__footer">{footer}</footer>}
    </section>
  );
}
