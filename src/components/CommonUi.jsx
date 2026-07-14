export function MetricCard({
  label,
  value,
  detail,
  tone,
  indicator,
  onClick,
  active = false,
}) {
  const Component = onClick ? 'button' : 'article';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      className={
        'metric-card metric-card--' +
        tone +
        (onClick ? ' metric-card--interactive' : '') +
        (active ? ' metric-card--selected' : '')
      }
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
    >
      <div className="metric-card__top">
        <span>{label}</span>
        <span className="metric-card__dot" />
      </div>
      <strong>{value}</strong>
      <div className="metric-card__bottom">
        <span>{detail}</span>
        <em>{indicator}</em>
      </div>
    </Component>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="card-header">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="card-header__action">{action}</div>}
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span><i className="legend__income" /> Einnahmen</span>
      <span><i className="legend__expense" /> Ausgaben</span>
    </div>
  );
}

export function ContextFact({ label, value }) {
  return <span><small>{label}</small><strong>{value}</strong></span>;
}
