# UX-Testkatalog: Objektarbeitsfläche

Dieser Katalog ist für die reale Browserabnahme der nicht-modalen Arbeitsfenster verbindlich. Automatisierte Modelltests ersetzen dabei nicht die sichtbare Prüfung von Fokus, Pointer Events, Überläufen und Persistenz.

## Prüfumgebungen

| Kennung | Viewport | Erwarteter Modus |
| --- | ---: | --- |
| D1 | 1920 × 1080 | Desktop |
| D2 | 1366 × 768 | Desktop |
| C1 | 1024 × 768 | Kompakt |
| M1 | 760 × 900 | Mobil, einschließlich Grenzwert 760 |
| M2 | 390 × 844 | Mobil |

Für jeden Lauf Browserkonsole, horizontales Seiten-Overflow und Fokusposition protokollieren. Am Ende wird der ursprüngliche Musterbestand wiederhergestellt.

## W-01: Vorschau öffnen und ersetzen

1. Eine Buchung als Vorschau öffnen.
2. Hauptseite hinter dem nicht-modalen Fenster weiter bedienen.
3. Eine zweite Buchung als Vorschau öffnen.

Erwartung: Es existiert höchstens eine Vorschau. Die zweite ersetzt die erste. Ein eventuell geöffneter Editor bleibt erhalten. Die Vorschau trägt `role="dialog"` und `aria-labelledby`, aber kein `aria-modal`.

## W-02: One-writer-Gate

1. „Neue Buchung“ als Editor öffnen.
2. Daten verändern.
3. Aus einem anderen Kontext erneut einen Editor anfordern.

Erwartung: Der zweite Editor wird nicht geöffnet. Der vorhandene Editor wird benannt beziehungsweise aktiviert. Vorschauen bleiben möglich.

Zusätzlicher Reverse-Lauf:

1. Zuerst Kontaktakte, Mietverhältnis, Wiederholungsregel oder Kategorie bearbeiten und einen Wert ändern.
2. Danach „Neue Buchung“ auslösen.
3. Mit dem alten Entwurf zu einem anderen Hauptbereich oder Mieter-Tab wechseln.

Erwartung: Der Buchungseditor bleibt geschlossen und der vorhandene Writer erhält Fokus. Ein Bereichswechsel verwirft einen schmutzigen Altentwurf niemals ohne Bestätigung. Umgekehrt fokussieren dieselben Schreibaufrufe bei offenem Buchungseditor dessen Entwurf.

## W-03: Dirty, Minimieren und Wiederherstellen

1. Im Editor Beschreibung, Betrag, Datei und manuelle Einheitenanteile setzen.
2. Editor minimieren und auf eine andere Hauptnavigation wechseln.
3. Editor über die Taskbar wiederherstellen.

Erwartung: Draft, `File`, `manualAmounts`, Status, Fehler und Dirty-Markierung sind unverändert. Die Taskbar benennt Editor/Vorschau und kündigt ungespeicherte Änderungen für Screenreader an.

## W-04: Verwerfen ohne Browserdialog

1. Dirty Editor schließen oder eine konfliktbehaftete Navigation auslösen.
2. Im Inline-Verwerfen-Slot zunächst abbrechen, dann erneut schließen und verwerfen.

Erwartung: Kein `window.confirm`. Beim Abbrechen bleibt alles erhalten. Erst die explizite Verwerfen-Aktion entfernt den Editor. Ein sauberer Editor schließt ohne Nachfrage.

## W-05: Speichern und Fehler

1. Pflichtfelder vollständig ausfüllen und speichern.
2. Einen kontrollierten Speicherfehler auslösen.
3. Danach erfolgreich speichern.

Erwartung: `onSave` liefert `{ok,error}`. Bei Fehler bleibt das Fenster samt Entwurf offen und zeigt die Fehlermeldung. Nur die Integration schließt nach `ok: true`. Es gibt keinen Erfolgshinweis bei fehlgeschlagener Speicherung.

## W-06: Fachvalidierung des Buchungseditors

- Nur Beginn oder nur Ende des Leistungszeitraums: Speichern blockiert.
- Ende vor Beginn: Speichern blockiert.
- Manuelle Verteilung ungleich Gesamtbetrag: Speichern blockiert.
- Datei über 250 KB: Speichern blockiert.
- Immobilien-, Einheiten-, Kategorie- und Vertragsreferenzen werden im Senior-Save-Callback direkt vor dem atomaren Schreiben erneut geprüft.
- Erfolgreiche Buchung bewahrt historische Verteilung, Leistungszeitraum und Beleg.

## W-07: Schreibgeschützte Vorschau

1. Vorschau mit `readOnly=true` öffnen.
2. Löschen und „Dokument anhängen“ prüfen.
3. „Original öffnen“ bei vorhandenem Beleg ausführen.

Erwartung: Mutationstasten sind deaktiviert und erklären den Grund. Das Original bleibt in einem neuen Tab erreichbar. Schließen bleibt möglich.

## W-08: Pointer-Drag und Viewport-Clamp

1. Floating-Fenster per Kopfzeile an alle vier Viewportränder ziehen.
2. Schnelle Pointer-Bewegung sowie Pointer-Cancel auslösen.
3. Viewport verkleinern.

Erwartung: Pointer Capture verhindert Abreißen. Das vollständige Fenster bleibt innerhalb des Viewports. Controls in der Kopfzeile starten keinen Drag. Auf Mobil ist Drag deaktiviert.

## W-09: Tastatur und Fokus

1. Editor ausschließlich per Tastatur öffnen.
2. Fokus, Tab-Reihenfolge, Pfeiltasten am Drag-Handle und Escape prüfen.
3. Fenster minimieren und wiederherstellen.

Erwartung: Im Editor erhält das Immobilienfeld zuerst Fokus; der Dialogroot ist nur Fallback. Pfeiltasten und Pointer-Drag lösen eine feste Dockposition automatisch und verschieben das Fenster, Umschalt erhöht die Tastaturschrittweite. Escape löst die kontrollierte Schließanforderung aus. Nach Minimieren landet der Fokus auf dem zugehörigen Taskbar-Eintrag und bleibt nicht in einem unsichtbaren Fenster gefangen.

## W-10: Größen und Docks

Alle Kombinationen prüfen:

- Größen: Vorschau 480 × 420, kompakt 520 × 480, normaler Editor 640 × 560.
- Docks: Frei, links, Mitte, rechts.
- Zwischen 761 und 1179 px ist nur ein Fenster aufgeklappt; das andere bleibt über die Taskbar erreichbar.
- Bei Viewportbreite bis einschließlich 760 wird das Fenster als mobile Arbeitsfläche zwischen Kopfbereich und Taskbar aufgespannt.

Erwartung: Kein horizontaler Body-Overflow, Fensterinhalt scrollt intern, Kopf und Aktionen bleiben erreichbar.

## P-01: Objekt-Tabs

1. Tabs mit Maus sowie Tabulator und Enter bedienen.
2. Pfeil links/rechts, Home und End prüfen.
3. Einen deaktivierten Tab dazwischen platzieren.
4. Vertikale Variante mit Pfeil hoch/runter prüfen.

Erwartung: `tablist`, `tab`, `aria-selected`, `aria-controls` und Roving-Tabindex sind korrekt. Deaktivierte Tabs werden übersprungen. Badgewerte besitzen eine verständliche Beschriftung.

Inhaltszuordnung an allen Pflichtbreiten 1920 × 1080, 1366 × 768 und 760 × 900:

- Persistenter Kopf: Identität, Einheiten/Vermietung und drei Plan-/Vertragspaare.
- Übersicht: KPIs, Jahresverlauf und ergänzende Objektfakten; keine vollständige Buchungstabelle.
- Objektakte: Baum, Kontextakte, allgemeine Dokumente und höchstens fünf Bewegungen; keine wiederholten Mietwertblöcke.
- Finanzen & Belege: Suche, Filter, vollständige Tabelle und Belegzugriff; keine doppelten KPIs oder Charts.
- Für Dokument und Hauptinhalt gilt `scrollWidth <= clientWidth`.

## P-02: Kontextbewegungen

Für Objekt, Einheit, Mietverhältnis und Kontakt jeweils mehr als fünf Bewegungen anlegen, davon mindestens zwei am selben Datum.

Erwartung: Genau die fünf neuesten passenden Bewegungen erscheinen. Gleich datierte Bewegungen sind deterministisch nach ID sortiert. Direkte Zuordnungen und historische `allocations` werden berücksichtigt. Der Eingabebestand wird nicht umsortiert.

## P-03: Kontext an Finanzen übergeben

Für jeden Objektkontext „In Finanzen anzeigen“ auslösen.

| Kontext | Erwartete Filter |
| --- | --- |
| Immobilie | Immobilie gesetzt, Einheit und Mietverhältnis `all` |
| Einheit | Immobilie und Einheit gesetzt, Mietverhältnis `all` |
| Mietverhältnis | Immobilie und Mietverhältnis gesetzt, Einheit `all` |
| Kontakt im Vertrag | wie Mietverhältnis über `tenancyId` |

Erwartung: Auch gemeinsam vermietete Nebeneinheiten bleiben über den Mietverhältnisfilter sichtbar.

## R-01: Finanzsuche und Kategorien

- „miet“, „Miete“, „MIETE“ und „Kaltmiete“ gegen Mietzahlungen und Kategoriepfade prüfen.
- Umlaute, Akzente, `ß`, Mehrwortsuche und zusätzliche Leerzeichen prüfen.
- Hauptkategorie filtern: direkte Buchungen und sämtliche Nachfahren sichtbar.
- Unterkategorie filtern: nur eigener Zweig sichtbar.
- Verwaiste oder zyklische Kategorien: im Filter einmalig sichtbar, keine Endlosschleife.
- Dieselben Such- und Hierarchiefälle sowohl in der globalen Finanzseite als auch in „Finanzen & Belege“ einer Immobilie prüfen.

## Automatisierte Mindestabdeckung

- `workspaceModel.test.js`: Zustände, One-writer-Gate, Preview-Ersatz, Dirty, Payloaderhalt, Minimierung, Docks, Größen, Clamp und Responsive-Grenzen.
- `propertyWorkspace.test.js`: deterministische Top 5 und Kontext-/Finanzmapping.
- `germanSearch.test.js`: deutsche Normalisierung und Kategorien im Suchraum.
- `categoryFilter.test.js`: Hierarchie, Orphans und Zyklen.
- Produktions-Build nach jeder Integration.
