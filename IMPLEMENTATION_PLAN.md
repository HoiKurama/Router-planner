# PromptRouter – verbindliche Implementierungsspezifikation

Stand: 28.09.2026. Diese Datei übernimmt den im Chat verabschiedeten Plan. Tatsächlicher Fortschritt steht ausschließlich in PROJECT_STATE.md.

## Product Definition

PromptRouter kombiniert lokale Aufgabenanalyse, quelltexttreue Prompt-Strukturierung und eine erklärbare Empfehlung aus einem fiktiven Modellkatalog. Oberfläche: Deutsch; Eingaben: Deutsch und Englisch. Standardpriorität: Balanced.

MVP: keine KI-APIs, keine Ausführung der Aufgabe, keine Datei-Uploads, keine echte Recherche, keine Konten, Telemetrie oder Prompt-Speicherung. Nach Installation und Start eines lokalen Servers funktioniert die Anwendung ohne externe Requests. Nur die Theme-Präferenz darf gespeichert werden.

Eine rein lokale, regelbasierte Optimierung kann fehlende Intention nicht zuverlässig erfinden. Deshalb bleibt der Originaltext vollständig erhalten; fehlende Angaben werden als separate Vorschläge angezeigt.

## User Flow

1. Prompt schreiben oder Beispiel übernehmen; Fast/Balanced/Best wählen.
2. Analysieren: validieren, TaskAnalysis erzeugen und Anforderungen ableiten.
3. Optimizer und Router verwenden dieselbe Analyse unabhängig voneinander.
4. Analyse, strukturierten Prompt, Modell/Variante/Workflow und Begründung darstellen.
5. Kopieren übernimmt den sichtbaren Text. Manuelle Änderungen brauchen vor neuer Empfehlung eine erneute Analyse; der Optimizer läuft dabei nicht erneut.
6. Originaländerungen verwerfen Ergebnisse. Moduswechsel berechnet nur Routing neu. Reset leert Inhalte und setzt Balanced; Theme bleibt.

## Architektur

- app/: Ablauf, Eingaberevisionen, asynchrone Dienst-Ports, React-Zustand.
- components/: Darstellung und Interaktion ohne fachliche Routing-Regeln.
- domain/: Typen, Skalen, gemeinsame fachliche Verträge.
- analyzer/: versionierte Regeln und Anforderungsableitung.
- optimizer/: Strukturierung, Quellteile, Renderer, Preservation Guard.
- router/: Kandidaten, Eignung, Scores, Unsicherheit und Erklärung.
- models/: Datenkatalog und Validierung.
- data/: Regeln, Richtlinie, Workflows und Beispiele.

Fachmodule sind unabhängig von React und Browser-APIs. Analyzer kennt keine Modelle. Optimizer kennt keine Routing-Priorität. Router erhält Registry und Kontext als Parameter und enthält keine Modellnamen-Abfragen. Erklärungen verwenden die tatsächlichen Score-Beiträge.

Kernverträge: analyzePrompt(input), deriveRequirements(analysis), optimizePrompt(input, analysis), routeTask(requirements, preferences, registry, context). Sie sind deterministisch; Eingaberevision und Versionskennungen gehören zu Ergebnissen.

AnalyzerPort und OptimizerPort sind austauschbar und asynchron. Lokale Adapter verwenden reine Funktionen. Künftige Provider-Ausführung erhält Modell-/Varianten-ID, Workflow und freigegebenen Prompt in einem eigenen Execution-Service. Provider-ID bleibt eine Zeichenfolge. Zugangsdaten und Provider-SDKs gehören später hinter eine Backend-Grenze; kein leeres Adapterframework im MVP.

## Domain Model

- TaskAnalysis: Sprache, belegtes Ziel, Aufgabenarten und Scores, Schwierigkeit, Bedarf, Einschränkungen, Schritte, Fundstellen, Konflikte und fehlende Informationen.
- TaskRequirements: Fähigkeiten mit Wichtigkeit/Mindeststufe, notwendige/verbotene Tools, Kontextbedarf, Prüfschritte und ungeklärte Bedingungen.
- ModelCapabilities: Coding, Mathematik, Reasoning, Recherche, Schreiben, Lernen, Datenanalyse, Planung, Tool-Nutzung; zusätzlich Modalitäten, Tool Calling und Kontextfenster.
- ModelProfile: stabile ID, Name, freie Provider-ID, Status, Herkunft, Version und Varianten.
- ModelVariant: tatsächlich unterstützte Reasoning-Einstellung und explizite Unterschiede bei Fähigkeiten/Betriebseigenschaften.
- RoutingPreferences: Modus; strukturierte Provider-Zulassung und ausgeschlossene Modelle als interne Schnittstelle, ohne Filter-UI im MVP.
- RoutingScore: Kandidat, Eignung, Score-Intervall, Einzelbeiträge und Ausschlüsse.
- RoutingDecision: recommended/provisional/abstained, Auswahl oder null, Alternativen, Begründung, Versionen.
- OptimizedPrompt: Quellteile, Einfügungen, sichtbarer Text, getrennte Vorschläge, Erhaltungsprüfung.
- WorkflowPlan: Zielumgebung, aktiv benötigte Tools und geordnete Schritte.

Bedarf: low/medium/high/unknown. Ja/Nein-Felder erlauben unknown. Bewertungen: 0–4 oder null; null ist unbekannt. Evidence verwendet UTF-16-Originalindizes. Ein Ausdruck über das gewünschte Produkt (z. B. offlinefähige App) ist keine Modell-Deployment-Vorgabe.

## Analyse und Anforderungen

Deutsche/englische Signale: Stärke 1 unterstützendes Wort, 2 Kontextkombination, 3 eindeutiges Muster. Regel zählt höchstens einmal. Kategorie wird ab 3 Punkten gestützt. Eindeutigkeit verlangt eine Signatur oder mehrere unabhängige Signale. Eng konkurrierende Deutungen bleiben mehrdeutig. Unbekannt ist kein automatischer Reasoning-Fallback. *(Geändert mit rules-v2: Die Analyse bleibt „unbekannt“, das Routing nutzt aber ein ausdrücklich markiertes, immer vorläufiges und abschaltbares Fallback-Profil, sobald der Text Wörter enthält. Begründung in PROJECT_STATE.md.)*

Zitate/Code sind Kontext; Handlungsanweisungen außerhalb führen die Klassifikation. Negationen beachten. Textlänge oder das Wort komplex erhöhen die Schwierigkeit nicht alleine.

Schwierigkeit 1: einfache Einzelaufgabe; 2: Routine; 3: begrenzte mehrstufige Aufgabe; 4: anspruchsvolle Fachaufgabe/Abhängigkeiten; 5: umfangreiche Abhängigkeiten oder formale Tiefe. Mindeststufen der Hauptfähigkeit: 1/2/2/3/4. Nebentätigkeiten übernehmen nicht pauschal die maximale Schwierigkeit.

Analyse umfasst Kategorie, Komplexität, Reasoning/Context/Tools, Geschwindigkeit, Genauigkeit, Multi-Step, Coding, Recherche und Dateizugriff. Genauigkeit erzeugt ggf. Prüfschritte und ist nicht automatisch hoher Reasoning-Bedarf. Freitext-Budgets/Modellvorgaben müssen erhalten bleiben; ungeklärte strikte Ausführungsvorgaben erlauben keine Behauptung ihrer Erfüllung.

## Routing

Kandidat = Modell + unterstützte Variante + Workflow. Standard bedeutet keine separate Reasoning-Einstellung. Provider-Level sind keine identischen Leistungsgrade; keine generischen High-Boni.

Eignung vor Scoring: deaktiviert/unverfügbar, explizite Einschränkung, fehlende Modalität/Tools, verbotenes notwendiges Tool, überschrittenes bekanntes Kontextfenster oder unterschrittene Mindestfähigkeit schließen aus. Eine unbekannte erforderliche Eigenschaft ist conditional. Ohne nachweislich geeignete Kandidaten keine Auswahl. Fehlender API-Adapter ist kein Ausschluss im Empfehlungs-MVP.

Grundgewichte: Coding 3 + Reasoning 1; Math 3 + Reasoning 2; Research 3 + Reasoning 1 + Writing 1; Writing 3; Teaching 3 + Reasoning 1; Data Analysis 3 + Reasoning 2; allgemeines Reasoning 3. Wichtigkeit 1 unterstützend/2 wichtig/3 zentral. Zusätzlicher Bedarf wird mit Maximum zusammengeführt; Nebenaufgaben ergänzen passende Fähigkeiten. Normierung auf Summe 1.

Q = Summe(Fähigkeitsgewicht × Bewertung/4); L = Speed/4; C = Cost Efficiency/4. Score = 100 × (wQ×Q + wL×L + wC×C).

| Modus | Qualität | Geschwindigkeit | Kosteneffizienz |
|---|---:|---:|---:|
| Fast | 40 % | 40 % | 20 % |
| Balanced | 60 % | 20 % | 20 % |
| Best | 100 % | 0 % | 0 % |

Diese Zahlen sind Policy, keine gemessenen Erfolgswahrscheinlichkeiten. Fast verschiebt 20 Punkte Qualität zu Speed. Best verwendet Speed/Kosten nur als Tie-Break. Keine kandidatensatzabhängige Min-Max-Normierung. Mindestanforderungen bleiben gleich.

Unbekannte gewichtete Bewertungen ergeben eine Untergrenze mit Beitrag 0 und eine Obergrenze mit Beitrag 1; keine Umverteilung der Gewichte. Sortierung zunächst nach Untergrenze. Score-Intervalle sind keine statistischen Konfidenzintervalle.

Provisional: Mehrdeutigkeit, fehlender Kontext, unbekannte relevante Werte, überlappende Intervalle oder höchstens 5 Punkte Abstand. 5 Punkte entsprechen einer Bewertungsstufe bei 20 % Gewicht. Abstained: unbekannte Aufgabe, entscheidender Konflikt oder keine geprüfte Eignung. Alternativen: bis zu zwei verschiedene Modelle; Varianten zusammenfassen.

Tie-Break nach auf Hundertstel gerundetem Score: Quality-Untergrenze, bekannte Speed, bekannte Cost Efficiency, weniger aktive Tools, stabile IDs ohne Locale-Abhängigkeit. Registry-Reihenfolge ist irrelevant.

Workflow-Schritte: Kontext klären/lesen, recherchieren, planen, bearbeiten, prüfen – nur begründete Schritte. Zielumgebungen: Chat, Recherche, Arbeitsumgebung, Arbeitsumgebung+Recherche. Sie sind hypothetische Empfehlungen, keine Ausführung.

## Optimizer

Automatisch: nur belegbare Struktur/kurze Überschrift. Kein Umschreiben, Löschen oder Umordnen. Erhalte Original, Zahlen, Namen, Pfade, Code, Zitate, Formate, Negationen und Prioritäten. Gute Prompts können unverändert bleiben. Ergänzende Angaben bleiben getrennte Vorschläge bis zur Nutzerbearbeitung.

Guard: vollständige, geordnete und überschneidungsfreie Quellabdeckung; korrekter Renderer; keine Einfügung innerhalb geschützter Bereiche; keine Strukturverdoppelung; Längengrenze. Fehler führt zum Original und sichtbarer Diagnose. Künftige generative Ersetzungen brauchen einen sichtbaren Vergleich und Freigabe. Manuelle Änderungen sind als solche markiert.

## Registry

Typisierte zentrale Daten plus Laufzeitvalidierung, kein Katalogeditor oder JSON-Import. Demo Speed/Balanced/Coding/Reasoning/Research/Writing/Data; Reasoning hat medium/high. Exakte Daten stehen in src/models/catalog.ts und bleiben illustrative. Kein Mapping der Namen auf reale Produkte, keine realen Preise/Latenzen. Alle Demo-Profile hypothetisch Text/Tool Calling; Kontext und Echtzeit-Verfügbarkeit unbekannt.

Prüfe eindeutige IDs, 0–4/null, vollständige Metadaten, bekannte Fähigkeiten, Varianten und Workflows. Keine stillen Korrekturen. Neues Modell/Provider-ID ist Datenänderung; neue Fähigkeit ist Fachänderung mit Tests.

## UI

Eine Ansicht: Original links, Analyse Mitte, optimierter Prompt rechts, Empfehlung darunter. Mobile: gestapelt. Analyse zeigt zunächst Ziel/Kategorie/Schwierigkeit/fehlende Angaben; Detailwerte aufklappbar. Empfehlung: Modell, Reasoning, Workflow, bis zu drei Gründe. Details: Beiträge, Alternativen, Ausschlüsse. Keine Erfolgswahrscheinlichkeit oder Radar-Grafik.

Dark/Light, Systemstandard, nur Theme speichern. Hinweis Lokal/Regelbasiert/Demo. Tastatur/Fokus/Labels und Statusmeldungen. Maximal 20.000 Unicode-Zeichen, nie still abschneiden. Kopierfehler ehrlich melden und manuelles Kopieren anbieten. Kein ungeprüftes HTML, keine externen Fonts/Requests und keine künstlichen Verzögerungen.

## Tests und Evaluation

Vitest: Klassifizierung, Schwierigkeiten, DE/EN, Misch-/unbekannte Aufgaben, Negation, Scope, Code/Zitate, Wiederholung, Unicode/Leer/Länge; Preservation und Idempotenz; Registry; Eligibility; Unknown-Intervalle; Reasoning-Level; Tie-Breaks; Erklärung.

Invarianten: keine Modusumgehung, monotone Bewertungen, Namens-/Reihenfolgeunabhängigkeit, Zusatzkandidat verändert vorhandene Scores nicht, kein unbekannter Mittelwert.

Referenz einfache Mathematik: Speed Fast/Balanced/Best 80/70/50; Balanced 75/75/75; Reasoning-high 55/70/100.

Sieben Beispiele in DE und EN: einfache Rechnung, Beweis, React-Projekt, Text verbessern, aktuelle Recherche, Datei analysieren, komplexe Coding-Migration. Unabhängige handgeprüfte Regressionsfälle enthalten Kategorien, Schwierigkeitsbereiche, Bedürfnisse, verbotene Entscheidungen, zulässige Modellmengen und Entscheidungsstatus. Baselines versioniert; kein blindes Snapshot-Update. Evaluation berichtet akzeptable Wahl, korrekten Verzicht und harte Verletzungen.

UI: Analyse, Moduswechsel, Edit/Neubewertung, Reset, Kopiererfolg/-fehler, veraltete Ergebnisse. Echter Browser: Desktop/Mobil, beide Themes, Tastatur, lange Eingabe und keine externen Requests.

## Phasen und Abnahme

0 Dokumente; 1 Grundgerüst/Typen; 2 Analyzer; 3 Registry/Router; 4 Optimizer; 5 vollständige UI; 6 zweiter Review/Evaluation/Dokumentation. Nach Fachphasen Code prüfen, Tests, Typecheck/Build; UI sobald vorhanden. Wiederholung nur bei Änderungen/Fehlern/offenen Risiken.

Befehle: dev, build, preview, typecheck, lint, test, test:watch, evaluate. Abschluss erst bei vollständigem Ablauf, Preservation, korrekten Ausschlüssen, erklärbarer Unsicherheit, Daten-Erweiterbarkeit, bestandenen Prüfungen und aktueller Dokumentation.

PROJECT_STATE.md: Goal, Current State, Important Decisions, Relevant Facts, Open Questions, Next Steps. Kurz halten; bestätigte Tests, Datum, konkrete Schritte, kein Chat-Archiv. README enthält Betrieb und Erweiterung; Spezifikation bleibt hier.
