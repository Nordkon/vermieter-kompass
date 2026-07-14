# Vermieter Kompass – Demo

Eine lokal laufende Web-Demo für Kleinstvermieter mit bis zu zehn Immobilien. Die Anwendung verbindet Objektverwaltung, Mieterakten, Mieterkonten, Buchungen, Dokumente und Auswertungen in einer gemeinsamen Oberfläche. Sie läuft vollständig im Browser und benötigt weder Server noch Datenbank.

## Navigation und Funktionsumfang

Die Hauptnavigation folgt dem fachlichen Arbeitsablauf:

1. **Übersicht** – Dashboard mit Einnahmen, Ausgaben, Überschuss, Vermietungsstand und Aufgaben.
2. **Immobilien** – Objektübersicht, Stammdaten und der Objektbaum Immobilie → Einheit → Mietverhältnis → Mietpartei.
3. **Mieter** – eigener Arbeitsbereich mit den Tabs **Mietparteien**, **Mietverhältnisse** und **Mieterkonten**.
4. **Finanzen** – Einnahmen, Ausgaben, Kostenverteilung und wiederkehrende Sollstellungen.
5. **Dokumente** – zentrale, durchsuch- und filterbare Dokumentenablage.
6. **Auswertungen** – Monats- und Jahresauswertungen nach Immobilie.
7. **Einstellungen/Kategorien** – Kosten- und Einnahmekategorien mit Haupt- und Unterkategorien.

### Immobilien und Einheiten

- Wohn- und Gewerbeimmobilien testweise anlegen, maximal zehn Objekte.
- Objektanschriften werden getrennt als Straße, PLZ, Ort und Land gespeichert.
- Detailseite je Immobilie mit Stammdaten, Jahresverlauf, Buchungen und Dokumenten.
- Eigene Wohn-, Gewerbe- und Nebeneinheiten ergänzen.
- Soll-Kaltmiete und Soll-Betriebskostenvorauszahlung werden je Einheit gepflegt; die Objektakte aggregiert daraus Plan-Kaltmiete, Plan-Nebenkosten und Plan-Warmmiete. `Nicht gepflegt`, bewusst `0,00 €` und teilweise gepflegte Mehrfacheinheiten bleiben in Liste, Detail und Objektakte sichtbar unterscheidbar. Aktuelle Vertragswerte erscheinen separat.
- Einfamilienhäuser besitzen genau eine Haupteinheit und optional höchstens eine zugeordnete Garage oder einen Stellplatz.
- Haupt- und Nebeneinheit können gemeinsam einem Mietverhältnis zugeordnet werden.
- Überschneidende Vertragszeiträume derselben Einheit werden beim Anlegen verhindert; beendete Verträge bleiben als Historie erhalten.

### Mieterbereich

- Suche und Filter für Mietparteien, Mietverhältnisse und Kontobuchungen.
- Vollständig bearbeitbare Kontaktakte mit Person/Firma, Vorname, Nachname, Geburtstag, Firmenname, strukturierter Anschrift, E-Mail, Telefon, Mobilnummer und Notizen.
- Ein Kontaktklick im Objektbaum bleibt in der Immobilienakte und öffnet dieselbe vollständige Kontaktakte rechts. Erst der zusätzliche Button **Im Mieterbereich öffnen** wechselt den Arbeitsbereich.
- Die Anschrift eines verknüpften Mietobjekts kann bewusst als einmaliger, danach unabhängiger Schnappschuss in die Kontaktakte kopiert werden.
- Kontakt und Mietverhältnis bleiben getrennt: Einzug und Auszug gehören zum Vertrag, nicht zur Person.
- Ein Mietverhältnis kann mehrere bestehende Kontakte als Vertragsparteien enthalten, davon exakt einen Hauptkontakt.
- Vertragsbeginn und Vertragsende werden getrennt von tatsächlichem Einzug und Auszug geführt.
- Haupteinheit und optionale Nebeneinheit werden als eigene Beziehungen zum Mietverhältnis gespeichert.
- Kaltmiete, Nebenkostenvorauszahlung und vereinbarte Kaution werden am Vertrag erfasst.
- Beim Auswählen einer Einheit werden deren Planwerte einmalig vorgeschlagen. Bereits manuell geänderte Vertragswerte werden durch einen späteren Einheitenwechsel nicht ungefragt überschrieben.

### Mieterkonto und Wiederholungsregeln

- Das Mieterkonto zeigt **Soll**, **Haben** und den offenen **Saldo** je Mietverhältnis oder über alle Konten.
- Sollstellungen, Zahlungen, Korrekturen und Abrechnungsergebnisse besitzen eigene Kontoeinträge.
- Zahlungen und Teilzahlungen werden als Habenbuchung dem gewählten Mietverhältnis zugeordnet und erzeugen atomar eine betrags- und datumsgleiche Einnahmenbewegung. Beide Datensätze referenzieren sich gegenseitig.
- Die verknüpfte Einnahmenbewegung kann nicht unabhängig gelöscht werden. **Mietzahlung stornieren** entfernt nach Bestätigung beide Seiten atomar; anschließend kann die Zahlung korrekt neu gebucht werden. Korrekturen und Abrechnungsergebnisse sind keine Zahlungen.
- Beim Anlegen eines Mietverhältnisses entstehen für Kaltmiete und Nebenkostenvorauszahlung monatliche Regeln, sofern die Beträge größer als null sind.
- Zusätzliche Regeln können monatlich, quartalsweise oder jährlich mit erster Fälligkeit, optionalem Ende, Fälligkeitstag und Betrag angelegt werden.
- Fällige Sollstellungen werden nur auf ausdrücklichen Befehl bis zu einem Stichtag erzeugt.
- Ein deterministischer Vorkommnisschlüssel verhindert doppelte Sollstellungen, wenn derselbe Zeitraum erneut erzeugt wird.
- Bereits erzeugte Kontoeinträge bleiben als historische Buchungen erhalten.

### Finanzen, Jahreskosten und Dokumente

- Einnahmen und Ausgaben können einer Immobilie oder konkreten Einheit zugeordnet werden.
- Jahreskosten wie Wasser, Grundsteuer oder Gebäudeversicherung werden einmalig als Objektkosten mit vollständigem Leistungszeitraum erfasst.
- Umlagefähige Kosten lassen sich nach Fläche, je Einheit, direkt oder manuell verteilen.
- Bei vorhandenem Leistungszeitraum zeigt die Vorschau zeitanteilige Anteile nach Vertrags- beziehungsweise Einzugszeiträumen; Leerstandszeiträume bleiben als Eigentümeranteil sichtbar.
- Gespeicherte Verteilungen bleiben als historische Schnappschüsse mit Bezug auf Einheit und Mietverhältnis erhalten.
- Die Jahresvorschau verbindet periodenrichtige Kostenanteile, vereinbarte Betriebskostenvorauszahlungen und das Abrechnungsergebnis. Fehlende Sollmonate blockieren den Abschluss; Zahlungsrückstände werden separat angezeigt.
- Eine ausdrücklich mit `0,00 €` vereinbarte Betriebskostenvorauszahlung ist ohne Monatsregel abrechenbar. Eine positive Vereinbarung ohne typisierte Vorauszahlungsregel bleibt dagegen gesperrt.
- Die Jahreskosten selbst werden nicht als monatliche Mieterforderung verbucht. Erst der bestätigte, dublettengeschützte Abschluss erzeugt eine Forderung oder ein Guthaben im Mieterkonto.
- Buchungen besitzen eine Such- und Filteransicht sowie eine anklickbare Detail- und Belegvorschau.
- PDF- und Bildbelege bis 250 KB können vollständig lokal gespeichert werden. Schlägt das Speichern im LocalStorage fehl, meldet die Oberfläche den Fehler und zeigt keinen irreführenden Erfolg.
- Dokumente lassen sich Immobilien, Einheiten, Mietverhältnissen, Mietparteien oder Buchungen zuordnen. Die Objektakte zeigt auch Dokumente ihrer Unterbereiche, ohne sie doppelt abzulegen.

### Bedienkomfort und geführtes Tutorial

- Das Mieterkonto verwendet ein kompaktes, responsives Layout. Filter, Datumsfelder, Betrag, Buchungsseite und Leistungszeitraum bleiben innerhalb ihrer Bereiche; lange Kontobezeichnungen werden gekürzt dargestellt, ohne die Soll- und Haben-Spalten zu verdrängen. Das Buchungsformular wechselt abhängig von der verfügbaren Breite von vier über zwei auf eine Spalte, während die Buchungstabelle auf kleinen Bildschirmen horizontal scrollbar bleibt.
- Mietparteien sind direkt im rechten Bereich der Objektakte les- und bearbeitbar. Objektbaum, Dokumente und Bewegungen bleiben dabei sichtbar.
- Das gamifizierte Tutorial lässt sich über den Eintrag **Tutorial** in der Sidebar oder unter **Einstellungen/Kategorien** starten. Es führt mit hervorgehobenen Zielen und kurzen Aufgaben durch die echte Anwendungsoberfläche, statt Funktionen nur in einer langen FAQ zu beschreiben.
- Der Tutorialfortschritt wird lokal gespeichert. Eine Tour kann minimiert werden, ohne Schritt oder Status zu verändern. **Pausieren** bleibt eine getrennte, beschriftete Aktion.
- Während der Tour angelegte Übungsobjekte, Einheiten, Mietparteien, Mietverhältnisse und weitere Beispieldaten werden technisch mit der jeweiligen `tutorialSessionId` markiert. Beim Abschluss kann der Benutzer diese Daten bewusst behalten oder entfernen.
- Eine Tutorialbereinigung löscht ausschließlich Datensätze und Beziehungen der gewählten `tutorialSessionId`. Vorhandene Demo- und Nutzerdaten sowie Übungsdaten anderer Sessions bleiben unangetastet.

## Datenschema v4

Schema v4 erweitert die fachlich getrennten v3-Datensätze um strukturierte Objektanschriften, Einheiten-Planwerte und sichere Zahlungsbeziehungen:

- `contacts`: strukturierte Personen- und Firmenakten einschließlich Anschrift und Kommunikation.
- `tenancies`: Vertragsbeginn/-ende, Einzug/Auszug, Miete, Vorauszahlung und Kaution.
- `tenancyParties`: Verbindung zwischen Mietverhältnis und einer oder mehreren Vertragsparteien, einschließlich Hauptkontakt.
- `properties`: strukturierte Anschrift mit `address`, `postalCode`, `city` und `country`; alte Mehrparteien-Objektmieten bleiben nur als gekennzeichnete historische Information erhalten.
- `units`: Haupt- und Nebeneinheiten mit `unitKind`, `ancillaryType`, `parentUnitId`, `targetColdRent` und `targetUtilityAdvance`. `null` bedeutet „nicht hinterlegt“, `0` bleibt eine bewusste Vorgabe.
- `tenancyUnits`: Verbindung zwischen Mietverhältnis und Haupt- beziehungsweise Nebeneinheit.
- `recurringRules`: monatliche, quartalsweise oder jährliche Regeln für künftige Sollstellungen.
- `accountEntries`: Sollstellungen, Zahlungen, Korrekturen und Abrechnungsergebnisse für Mieterkonten.
- `transactions`: tatsächliche Einnahmen und Objektkosten; optional mit Beginn und Ende des Leistungszeitraums sowie bidirektionaler Referenz zur zugehörigen Mieterkonto-Zahlung.

Die Demo speichert zusätzlich Immobilien, Kategorien, Dokumente und historische Verteilungsschnappschüsse. Monatsmiete und Vorauszahlungen werden über Regeln als Soll ins Mieterkonto gestellt. Objektkosten bleiben dagegen Finanzbuchungen; erst das Abrechnungsergebnis wird zu einer Mieterforderung oder einem Guthaben.

## Sichere Migration auf v4

Beim ersten Start mit einem älteren lokalen Datenbestand erfolgt die Migration automatisch:

1. Die vorhandenen v2-Listen werden vollständig gelesen. Ungültiges JSON oder ein falscher Datentyp bricht die Migration ab.
2. Eine reine, deterministische Migration erzeugt zunächst die v3-Struktur und erweitert sie anschließend auf v4. Bestehende unbekannte Felder und historische Verteilungsschnappschüsse bleiben erhalten.
3. Deutsche Altanschriften werden, soweit eindeutig, in PLZ und Ort getrennt. Bei genau einer Haupteinheit wird ein alter Objekt-Planwert dorthin übernommen; bei mehreren Einheiten bleibt er ausschließlich als historischer Objektwert erhalten und wird nicht erfunden verteilt.
4. Der erzeugte v4-Zustand wird vor dem Speichern validiert, unter anderem auf eindeutige IDs, gültige Referenzen, exakt einen Hauptkontakt und konsistente Leistungszeiträume.
5. Der komplette v2-Zustand wird einmalig unter `vermieter-demo-v2-backup` im LocalStorage gesichert.
6. Die Schema-Version wird erst nach allen Datensätzen auf `4` gesetzt. Eine unterbrochene Migration kann dadurch beim nächsten Start wieder aufgenommen werden.

Wichtige Schutzregeln:

- Die Migration erzeugt **keine rückwirklichen Mietschulden**; das Mieterkonto beginnt ohne erfundene Altforderungen.
- Migrierte Miet- und Vorauszahlungsregeln starten erst mit einer künftigen Fälligkeit.
- Alte Buchungen erhalten keinen erfundenen Leistungszeitraum.
- Fehlende Altreferenzen werden als prüfbare Platzhalter erhalten und nicht stillschweigend verworfen.
- Historische Vertragsüberschneidungen bleiben unverändert und werden im Mieterbereich als Prüfhinweis angezeigt.
- Das v2-Backup wird nicht bei jedem Start überschrieben.

## Leerer Start, Sicherung und Musterbestand

Ein neuer Browser-Ursprung startet fachlich leer; nur die Kosten- und Einnahmekategorien sind vorhanden. Dashboard, Finanzen, Dokumente, Auswertungen und Dialoge zeigen dafür eigene Leerezustände. **Neue Buchung** bleibt deaktiviert, bis mindestens eine Immobilie existiert.

Unten in der Navigation stehen zwei getrennte Aktionen bereit:

- **Fachdaten leeren** lädt vor dem Löschen automatisch ein JSON-Backup herunter und entfernt anschließend Objekte, Einheiten, Kontakte, Verträge, Relationen, Regeln, Konten, Bewegungen, Dokumente, Konflikte und Tutorialfortschritt. Kategorien bleiben bestehen.
- **Geprüften Musterbestand laden** sichert einen vorhandenen Bestand ebenfalls zuerst und lädt danach den nachvollziehbaren Terra-Prüffall „Haus Abendstern“ mit zwei Mietparteien, 38 Kontoeinträgen, fünf Kostenbuchungen und fünf öffnungsfähigen PDF-Belegen.

## Schnellstart unter Windows

Voraussetzung: **Node.js 20 oder neuer**.

Am einfachsten per Doppelklick:

```text
START-Vermieter-Kompass.bat
```

Die BAT installiert beim ersten Start automatisch fehlende Pakete, startet den lokalen Entwicklungsserver und öffnet die Anwendung im Standardbrowser. Das Konsolenfenster muss während der Nutzung geöffnet bleiben. Wenn die Anwendung bereits läuft, öffnet die BAT nur den Browser.

Startskript ohne Serverstart prüfen:

```text
START-Vermieter-Kompass.bat --check
```

Alternativ im Terminal:

```text
npm.cmd install
npm.cmd run dev
```

Danach im Browser öffnen:

```text
http://127.0.0.1:4173
```

## Tests und Produktions-Build

Alle Node-Smoke- und Fachlogiktests ausführen:

```text
npm.cmd test
```

Die Tests decken unter anderem Migration und Wiederaufnahme, Referenzvalidierung, Dublettenschutz der Wiederholungsregeln, Mieterkonto, Leistungszeitraum-Verteilung und die reinen Helfer des Mieterbereichs ab.

Produktions-Build erstellen und lokal prüfen:

```text
npm.cmd run build
npm.cmd run preview
```

Auch die Vorschau läuft unter `http://127.0.0.1:4173`. Wegen `strictPort` muss dieser Port frei sein; ein parallel laufender Entwicklungsserver ist vorher zu beenden.

## Datenspeicherung

Alle Änderungen werden im LocalStorage des verwendeten Browsers gespeichert. Es gibt keinen Server, keine Datenbank und keine Cloud-Synchronisierung. Daten aus einem anderen Browserprofil oder von einem anderen Computer stehen deshalb nicht automatisch zur Verfügung.

Zum Austausch oder Löschen des Bestands dienen **Fachdaten leeren** und **Geprüften Musterbestand laden**. Beide Aktionen erzeugen bei vorhandenen Fachdaten zuerst ein herunterladbares JSON-Backup; Kategorien bleiben beim Leeren erhalten.

## Demo über GitHub Pages veröffentlichen

Das Projekt enthält unter `.github/workflows/deploy-pages.yml` einen fertigen GitHub-Actions-Workflow. Er testet und baut die Vite-App bei jedem Push auf `main` oder `master` und veröffentlicht anschließend den Inhalt von `dist` über GitHub Pages.

1. Ein GitHub-Repository anlegen und dieses Projekt dorthin pushen.
2. Im Repository **Settings → Pages → Build and deployment → Source** auf **GitHub Actions** stellen.
3. Den Workflow unter **Actions → Deploy Vermieter Kompass to GitHub Pages** abwarten oder manuell starten.
4. Die veröffentlichte Adresse steht anschließend im Deployment und hat normalerweise die Form `https://BENUTZER.github.io/REPOSITORY/`.

Der notwendige Vite-Basispfad wird im GitHub-Workflow automatisch aus dem Repository-Namen ermittelt. Für eine eigene Domain kann optional die Repository-Variable `VITE_BASE_PATH` auf `/` gesetzt werden.

Die Veröffentlichung stellt ausschließlich die statische Demo bereit. Alle eingegebenen Daten verbleiben weiterhin im LocalStorage des jeweiligen Browsers und werden nicht zwischen Besuchern geteilt. In ein öffentliches Repository und in die Demo gehören deshalb keine echten Mieter-, Vertrags- oder Belegdaten.

## Projektstruktur

```text
src/
  components/
    tenants/                 Mieterbereich, Kontaktakte, Verträge und Mieterkonten
    DocumentsPage.jsx        Zentrale Dokumentenansicht
    RecurringRulesPanel.jsx  Wiederkehrende Sollstellungen
    weitere UI-Bausteine
  data/demoData.js           Beispieldaten
  lib/
    schemaV3.js              v3-Fachlogik für Konten, Regeln und Leistungszeiträume
    schemaV4.js              v4-Vertrag und deterministische v3→v4-Migration
    annualSettlement.js      Jahresvorschau und dublettengeschützter Abschluss
    paymentLink.js           Atomare Zahlung↔Einnahmen-Beziehung
    storage.js               LocalStorage-Anbindung und sichere Migration
    rentalModel.js           Einheiten-, Vertrags- und Kostenverteilungslogik
    tenantAreaModel.js       Reine Helfer für den Mieterbereich
    format.js                Deutsche Zahlen-, Datums- und Währungsformate
    *.test.js                Node-Smoke- und Fachlogiktests
  App.jsx                    Integration, Navigation und bestehende Ansichten
  styles.css                 Responsives Demo-Layout
  main.jsx                   React-Einstiegspunkt
```

## Bewusste Grenzen

Dies ist eine Vorführanwendung, keine produktionsreife Vermietungssoftware. Die Markierung „umlagefähig“, zeitanteilige Vorschauen und angezeigte Kostenanteile sind ausdrücklich Demo-Vorschläge und keine rechtssichere Nebenkostenabrechnung.

Es fehlen insbesondere Anmeldung, Benutzerrechte, serverseitige Datensicherung, revisionssichere Belegablage, echte Buchhaltung, Zahlungsimport und Bankabgleich, Mahnwesen, Zähler- und Heizkostenabrechnung, Steuerlogik, OCR, Datenschutzkonzept sowie eine produktive Abrechnungserstellung.
