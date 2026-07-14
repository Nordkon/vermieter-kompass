export function updateWriterOwner(current, writer) {
  if (!writer?.active) return !writer?.id || current?.id === writer.id ? null : current;
  const next = {
    id: String(writer.id || ''),
    label: String(writer.label || 'Andere Bearbeitung'),
    focusId: String(writer.focusId || ''),
    dirty: writer.dirty === true,
  };
  if (!next.id) return current || null;
  return current
    && current.id === next.id
    && current.label === next.label
    && current.focusId === next.focusId
    && current.dirty === next.dirty
    ? current
    : next;
}

export function transactionWriterAvailability({ externalWriter = null, blockingModal = false } = {}) {
  if (blockingModal) return { ok: false, reason: 'modal-active' };
  if (externalWriter) return { ok: false, reason: 'writer-active', blockedBy: externalWriter };
  return { ok: true };
}
