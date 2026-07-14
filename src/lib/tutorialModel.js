export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    eyebrow: 'Startklar',
    title: 'Deine erste Vermietung in zehn Etappen',
    task: 'Du arbeitest direkt in der echten Oberfläche. Während des Übungsmodus neu angelegte Datensätze werden sicher markiert und können am Ende gezielt entfernt werden.',
    actionLabel: 'Übersicht öffnen',
    reward: 'Kompass aktiviert',
  },
  {
    id: 'property',
    eyebrow: 'Etappe 1 · Fundament',
    title: 'Eine Immobilie anlegen',
    task: 'Lege ein Übungsobjekt mit Typ, Anschrift, Kurzname und Basisdaten an. Danach landest du direkt in seiner Objektakte.',
    actionLabel: 'Neue Immobilie öffnen',
    reward: '+100 XP · Objektstarter',
  },
  {
    id: 'units',
    eyebrow: 'Etappe 2 · Objektstruktur',
    title: 'Einheiten und Objektbaum verstehen',
    task: 'Prüfe die erzeugte Haupteinheit. Bei einem EFH darf optional genau eine Garage oder ein Stellplatz ergänzt werden.',
    actionLabel: 'Objektbaum ansehen',
    reward: '+80 XP · Strukturprofi',
  },
  {
    id: 'contact',
    eyebrow: 'Etappe 3 · Menschen',
    title: 'Eine vollständige Mietpartei anlegen',
    task: 'Erfasse Vorname, Nachname beziehungsweise Firma, Anschrift und Kommunikation in einer eigenen Kontaktakte.',
    actionLabel: 'Mietparteien öffnen',
    reward: '+100 XP · Aktenhüter',
  },
  {
    id: 'tenancy',
    eyebrow: 'Etappe 4 · Vertrag',
    title: 'Kontakt und Mietobjekt verbinden',
    task: 'Wähle bestehende Kontakte, bestimme den Hauptkontakt und trenne Vertragszeitraum sauber von Einzug und Auszug.',
    actionLabel: 'Mietverhältnisse öffnen',
    reward: '+140 XP · Vertragsnavigator',
  },
  {
    id: 'account',
    eyebrow: 'Etappe 5 · Mieterkonto',
    title: 'Soll, Haben und Saldo lesen',
    task: 'Erzeuge die fälligen Sollstellungen und erfasse anschließend eine Zahlung oder Teilzahlung. Der Saldo ist Soll minus Haben.',
    actionLabel: 'Mieterkonto öffnen',
    reward: '+120 XP · Kontenbändiger',
  },
  {
    id: 'recurring',
    eyebrow: 'Etappe 6 · Automatik',
    title: 'Eine Wiederholungsregel kennenlernen',
    task: 'Lege bei Bedarf eine Monats-, Quartals- oder Jahresregel an. Fälligkeit und Vertragsgrenzen verhindern Zeitreise-Forderungen.',
    actionLabel: 'Regeln öffnen',
    reward: '+100 XP · Regelmeister',
  },
  {
    id: 'annual',
    eyebrow: 'Etappe 7 · Jahreskosten',
    title: 'Kosten mit Leistungszeitraum buchen',
    task: 'Erfasse zum Beispiel Gebäudeversicherung oder Grundsteuer einmal jährlich. Die Vorschau trennt Mietzeit und Leerstand; erst das Abrechnungsergebnis gehört ins Mieterkonto.',
    actionLabel: 'Jahreskosten erfassen',
    reward: '+140 XP · Umlage-Scout',
  },
  {
    id: 'documents',
    eyebrow: 'Etappe 8 · Belege',
    title: 'Ein Dokument richtig zuordnen',
    task: 'Lege einen Beleg an der passenden Immobilie, Einheit oder am Mietverhältnis ab. So bleibt er auch aus der Objektakte auffindbar.',
    actionLabel: 'Dokumente öffnen',
    reward: '+80 XP · Papierlos',
  },
  {
    id: 'review',
    eyebrow: 'Finale · Kontrollrunde',
    title: 'Portfolio und neue Direktwege prüfen',
    task: 'Öffne Auswertungen und springe anschließend aus einem Objektbaum direkt in eine Kontaktakte oder ein Mietverhältnis.',
    actionLabel: 'Auswertung öffnen',
    reward: '1.000 XP · Vermieter-Kompass-Abzeichen',
  },
];

export const EMPTY_TUTORIAL_PROGRESS = {
  open: false,
  status: 'idle',
  stepIndex: 0,
  completed: [],
  skipped: [],
  sessionId: '',
  startedAt: '',
};

export function startTutorialProgress(sessionId, startedAt = new Date().toISOString()) {
  return {
    ...EMPTY_TUTORIAL_PROGRESS,
    open: true,
    status: 'active',
    sessionId,
    startedAt,
  };
}

export function finishTutorialStep(progress, stepId, skipped = false) {
  const nextCompleted = [...new Set([...(progress.completed || []), stepId])];
  const nextSkipped = skipped
    ? [...new Set([...(progress.skipped || []), stepId])]
    : (progress.skipped || []).filter((id) => id !== stepId);
  const atEnd = progress.stepIndex >= TUTORIAL_STEPS.length - 1;
  return {
    ...progress,
    completed: nextCompleted,
    skipped: nextSkipped,
    stepIndex: atEnd ? progress.stepIndex : progress.stepIndex + 1,
    status: atEnd ? 'completed' : 'active',
    open: true,
  };
}

export function tutorialProgressPercent(progress) {
  if (progress.status === 'completed') return 100;
  return Math.round(((progress.completed || []).length / TUTORIAL_STEPS.length) * 100);
}

export function belongsToTutorial(record, sessionId) {
  return Boolean(sessionId && record?.tutorialSessionId === sessionId);
}

export function buildTutorialCleanupPlan(state, sessionId) {
  const propertyIds = new Set((state.properties || [])
    .filter((item) => belongsToTutorial(item, sessionId))
    .map((item) => item.id));
  const unitIds = new Set((state.units || [])
    .filter((item) => belongsToTutorial(item, sessionId) || propertyIds.has(item.propertyId))
    .map((item) => item.id));
  const contactIds = new Set((state.contacts || [])
    .filter((item) => belongsToTutorial(item, sessionId))
    .map((item) => item.id));
  const tenancyIds = new Set((state.tenancies || [])
    .filter((item) => belongsToTutorial(item, sessionId))
    .map((item) => item.id));
  const transactionIds = new Set((state.transactions || [])
    .filter((item) => belongsToTutorial(item, sessionId) || propertyIds.has(item.propertyId))
    .map((item) => item.id));
  return {
    propertyIds: [...propertyIds],
    unitIds: [...unitIds],
    contactIds: [...contactIds],
    tenancyIds: [...tenancyIds],
    transactionIds: [...transactionIds],
  };
}
