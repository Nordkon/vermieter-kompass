import { useRef } from 'react';

const enabledTabs = (tabs) => tabs.filter((tab) => !tab.disabled);

export function PropertyTabs({
  tabs = [],
  activeId,
  onChange,
  ariaLabel = 'Bereiche der Immobilie',
  orientation = 'horizontal',
}) {
  const tabRefs = useRef(new Map());
  const available = enabledTabs(tabs);
  const tabStopId = available.some((tab) => tab.id === activeId) ? activeId : available[0]?.id;

  const selectAndFocus = (tab) => {
    if (!tab || tab.disabled) return;
    onChange?.(tab.id);
    tabRefs.current.get(tab.id)?.focus();
  };

  const handleKeyDown = (event) => {
    const currentIndex = available.findIndex((tab) => tab.id === activeId);
    if (!available.length) return;
    let nextIndex = currentIndex < 0 ? 0 : currentIndex;
    const previousKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    if (event.key === previousKey) nextIndex = (nextIndex - 1 + available.length) % available.length;
    else if (event.key === nextKey) nextIndex = (nextIndex + 1) % available.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = available.length - 1;
    else return;
    event.preventDefault();
    selectAndFocus(available[nextIndex]);
  };

  return (
    <div
      className={`property-tabs property-tabs--${orientation}`}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) tabRefs.current.set(tab.id, node);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={tab.tabId || `property-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={tab.panelId || `property-panel-${tab.id}`}
            tabIndex={tab.id === tabStopId ? 0 : -1}
            disabled={tab.disabled}
            className={selected ? 'property-tabs__tab property-tabs__tab--active' : 'property-tabs__tab'}
            onClick={() => selectAndFocus(tab)}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <small aria-label={`${tab.badge} Einträge`}>{tab.badge}</small>
            )}
          </button>
        );
      })}
    </div>
  );
}
