import { Icon } from './Icon.jsx';
import { TUTORIAL_STEPS, tutorialProgressPercent } from '../lib/tutorialModel.js';

export function TutorialSettingsCard({ progress, onOpen }) {
  const percent = tutorialProgressPercent(progress);
  const running = progress.status === 'active' || progress.status === 'paused';
  return (
    <section className="card tutorial-settings-card" aria-labelledby="tutorial-settings-title">
      <div className="tutorial-settings-card__icon"><Icon name="compass" size={28} /></div>
      <div>
        <span className="section-kicker">Geführter Rundgang</span>
        <h2 id="tutorial-settings-title">Vermietung spielerisch lernen.</h2>
        <p>Kein FAQ-Marathon: Du arbeitest Schritt für Schritt in der echten Oberfläche und kannst Übungsdaten danach gezielt aufräumen.</p>
        {running && <div className="tutorial-mini-progress"><span style={{ width: `${percent}%` }} /></div>}
      </div>
      <button type="button" className="button button--primary" onClick={onOpen}>
        <Icon name="play" size={17} />
        {running ? `Tutorial fortsetzen · ${percent} %` : progress.status === 'completed' ? 'Tutorial erneut ansehen' : 'Tutorial starten'}
      </button>
    </section>
  );
}

export function TutorialCoach({
  progress,
  milestones = {},
  onStart,
  onAction,
  onAdvance,
  onBack,
  onSkip,
  onPause,
  onMinimize,
  onResume,
  onKeep,
  onCleanup,
}) {
  if (progress.status === 'idle' && !progress.open) return null;

  if ((progress.status === 'paused' || progress.status === 'active') && !progress.open) {
    return (
      <button type="button" className="tutorial-resume" onClick={onResume}>
        <Icon name="compass" size={20} /> {progress.status === 'paused' ? 'Tutorial fortsetzen' : 'Tutorial einblenden'}
      </button>
    );
  }

  if (progress.status === 'idle') {
    return (
      <div className="tutorial-welcome-backdrop" role="presentation">
        <section className="tutorial-welcome" role="dialog" aria-modal="true" aria-labelledby="tutorial-welcome-title">
          <div className="tutorial-welcome__mark"><Icon name="compass" size={36} /></div>
          <span className="section-kicker">Vermieter-Kompass Akademie</span>
          <h2 id="tutorial-welcome-title">Bereit für deine erste geführte Vermietung?</h2>
          <p>Etwa 15 Minuten, zehn Etappen und null trockene Handbuchseiten. Neue Datensätze werden mit einer technischen Tutorial-ID markiert – nicht über Namen – und können später ausschließlich über diese ID entfernt werden.</p>
          <ul>
            <li>Pause und Fortsetzen funktionieren auch nach einem Reload.</li>
            <li>Es werden niemals ungefragt Buchungen erzeugt.</li>
            <li>Überspringen ist jederzeit möglich.</li>
          </ul>
          <div className="tutorial-welcome__actions">
            <button type="button" className="button button--primary" onClick={onStart}><Icon name="play" size={17} /> Übungsmodus starten</button>
            <button type="button" className="button button--ghost" onClick={onPause}>Später</button>
          </div>
        </section>
      </div>
    );
  }

  if (progress.status === 'completed') {
    return (
      <aside className="tutorial-coach tutorial-coach--complete" role="dialog" aria-label="Tutorial abgeschlossen">
        <div className="tutorial-coach__badge"><Icon name="compass" size={30} /></div>
        <span className="section-kicker">Mission erfüllt</span>
        <h2>Kompass-Abzeichen verdient.</h2>
        <p>Du hast den vollständigen Ablauf vom Objekt bis zur Kontrolle durchlaufen.</p>
        <strong className="tutorial-reward">1.000 XP · Vermieter-Kompass</strong>
        <div className="tutorial-coach__actions">
          <button type="button" className="button button--primary" onClick={onKeep}>Übungsdaten behalten</button>
          <button type="button" className="button button--ghost" onClick={onCleanup}>Übungsdaten aufräumen</button>
        </div>
      </aside>
    );
  }

  const step = TUTORIAL_STEPS[progress.stepIndex] || TUTORIAL_STEPS[0];
  const percent = tutorialProgressPercent(progress);
  const ready = step.id === 'welcome' || Boolean(milestones[step.id]);
  const minimize = onMinimize || onPause;

  return (
    <aside className="tutorial-coach" role="dialog" aria-label="Geführtes Tutorial" data-tutorial-step={step.id}>
      <div className="tutorial-coach__topline">
        <span>{progress.stepIndex + 1} / {TUTORIAL_STEPS.length}</span>
        <button type="button" className="icon-button" aria-label="Tutorial minimieren" title="Tutorial minimieren" onClick={minimize}><Icon name="minus" size={16} /></button>
      </div>
      <div className="tutorial-progress" aria-label={`Tutorialfortschritt ${percent} Prozent`}><span style={{ width: `${percent}%` }} /></div>
      <span className="section-kicker">{step.eyebrow}</span>
      <h2>{step.title}</h2>
      <p>{step.task}</p>
      <strong className="tutorial-reward">{step.reward}</strong>
      {step.id !== 'welcome' && (
        <div className={`tutorial-check${ready ? ' tutorial-check--ready' : ''}`}>
          <span>{ready ? '✓' : '○'}</span>
          {ready ? 'Aufgabe erkannt – Etappe kann abgeschlossen werden.' : 'Führe die Aufgabe aus oder überspringe diese Etappe bewusst.'}
        </div>
      )}
      <div className="tutorial-coach__actions">
        <button type="button" className="button button--ghost button--small" onClick={() => onAction(step)}>{step.actionLabel}</button>
        <button type="button" className="button button--primary button--small" onClick={() => onAdvance(step)} disabled={!ready}>Etappe abschließen</button>
      </div>
      <div className="tutorial-coach__footer">
        <button type="button" className="text-action" onClick={onBack} disabled={progress.stepIndex === 0}>Zurück</button>
        <button type="button" className="text-action" onClick={onPause}>Tutorial pausieren</button>
        <button type="button" className="text-action" onClick={onCleanup}>Tutorial beenden</button>
        {step.id !== 'welcome' && <button type="button" className="text-action" onClick={() => onSkip(step)}>Etappe überspringen</button>}
      </div>
    </aside>
  );
}
