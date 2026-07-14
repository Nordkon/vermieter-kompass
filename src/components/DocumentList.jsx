import { formatDate } from '../lib/format.js';
import { Icon } from './Icon.jsx';

export function DocumentList({ documents, onOpen }) {
  if (!documents.length) {
    return (
      <div className="document-empty">
        <Icon name="file" size={22} />
        <span>Noch keine Dokumente in diesem Bereich.</span>
      </div>
    );
  }

  return (
    <div className="document-list">
      {documents.slice(0, 8).map((document) => (
        <button
          type="button"
          key={document.id}
          className="document-row"
          onClick={() => onOpen(document)}
        >
          <span className="document-row__icon"><Icon name="file" size={18} /></span>
          <span>
            <strong>{document.name}</strong>
            <small>{document.documentType} · {formatDate(document.date)}</small>
          </span>
          <span className="document-row__action">Ansehen</span>
        </button>
      ))}
    </div>
  );
}
