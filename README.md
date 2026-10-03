# PromptRouter

PromptRouter analysiert einen Prompt lokal im Browser und empfiehlt, **welches Modell, welche Reasoning-Stufe und welcher Workflow** dazu passen – mit Begründung. Außerdem gliedert er den Prompt behutsam, ohne den Originaltext zu verändern.

Wichtig zur Einordnung:

- **Es wird kein KI-Modell aufgerufen.** Die App führt keine Aufgabe aus und sendet nichts ins Netz. Sie empfiehlt nur.
- **Die Modelle sind fiktiv** („Demo Speed“, „Demo Coding“ …). Ihre Werte sind illustrative Daten, keine Benchmarks echter Produkte.
- **Die Analyse ist regelbasiert** (reguläre Ausdrücke mit Punkten), nicht semantisch. Sie erkennt Deutsch und Englisch.

## Schnellstart

**Online:** <https://hoikurama.github.io/Router-planner/> – wird bei jedem Push auf `main` von `.github/workflows/static.yml` neu gebaut. In den Repository-Einstellungen muss unter *Pages → Source* „GitHub Actions“ gewählt sein.

**Lokal** (Voraussetzung: Node.js 24 und npm):

```sh
npm install
npm run build
```

Danach `dist/index.html` per Doppelklick öffnen. Die Datei ist in sich geschlossen (JS und CSS eingebettet) und funktioniert ohne Server und ohne Internet.

Zum Entwickeln mit automatischem Neuladen:

```sh
npm start        # öffnet http://localhost:5173/ im Browser
npm run dev      # derselbe Server ohne Browserfenster
```

Die Quelldatei `src/index.html` lässt sich **nicht** per Doppelklick öffnen – sie braucht den Entwicklungsserver. Die Seite erklärt das dann selbst, statt weiß zu bleiben.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm start` / `npm run dev` | Entwicklungsserver (Port 5173) |
| `npm run build` | Typprüfung und Build nach `dist/index.html` |
| `npm run preview` | Den Build über einen lokalen Server ansehen |
| `npm test` | Alle Tests (Vitest) |
| `npm run test:watch` | Tests im Watch-Modus |
| `npm run evaluate` | Nur die handgeprüften Routing-Fälle, mit Zusammenfassung |
| `npm run typecheck` / `npm run lint` | TypeScript und ESLint |

## Bedienung

1. Prompt eingeben oder ein Beispiel wählen, Priorität wählen (Fast, Balanced, Best).
2. **Analysieren** klicken oder **Strg+Enter** drücken.
3. Die Analyse zeigt Kategorie, Regel-Sicherheit in Prozent und unter **„Warum diese Kategorie?“** die Regeln, die gegriffen haben – mit der passenden Textstelle und ihren Punkten.
4. Die Empfehlung nennt Modell, Reasoning-Stufe, Workflow und Gründe. „Warum diese Empfehlung?“ zeigt die Score-Beiträge, Alternativen und ausgeschlossene Kandidaten.
5. Der optimierte Prompt lässt sich kopieren oder bearbeiten. Nach einer Bearbeitung muss er neu bewertet werden.

Gespeichert wird nur die Theme-Einstellung (hell/dunkel). Prompts liegen nur im Arbeitsspeicher der geöffneten Seite und verschwinden beim Neuladen.

## Wie eine Route entsteht

```
Prompt → Analyse (Regeln) → Anforderungen → Kandidaten bewerten → Entscheidung
```

1. **Analyse** (`src/analyzer/analyze.ts`): Zitate, Codeblöcke und verneinte Satzteile („schreibe keinen Code“) werden ausgeblendet. Jede Regel aus `src/data/analysisRules.ts` zählt höchstens einmal mit 1–3 Punkten. Eine Kategorie gilt ab 3 Punkten als erkannt; die stärkste ist die Hauptkategorie.
2. **Regel-Sicherheit** (0–100 %): halb aus der Signalstärke (6 Punkte = voll), halb aus dem Abstand zur nächstbesten Kategorie, höchstens 95 %. Unter 50 % ist eine Empfehlung immer vorläufig.
3. **Fallback**: Greift keine Regel, enthält der Text aber Wörter, nutzt das Routing ein allgemeines Profil (Reasoning + Schreiben). Die Empfehlung ist dann als „Fallback-Empfehlung“ markiert. Reine Zeichen- oder Zahlenfolgen und widersprüchliche Vorgaben (z. B. „aktuelle Nachrichten ohne Websuche“) führen weiterhin zu keiner Empfehlung.
4. **Anforderungen** (`deriveRequirements`): Die Kategorie bestimmt die gewichteten Fähigkeiten und eine Mindeststufe abhängig von der Komplexität. Dazu kommen benötigte Tools (Websuche, Dateizugriff, Codeausführung).
5. **Routing** (`src/router/route.ts`): Jede Kombination aus Modell und Variante wird zuerst auf Eignung geprüft und dann bewertet: `Score = 100 × (Qualität × wQ + Tempo × wT + Kosten × wK)`. Die Gewichte hängen von der Priorität ab. Knappe Abstände (≤ 5 Punkte), unbekannte Werte und unsichere Analysen machen die Empfehlung „vorläufig“.

## Konfiguration

| Was | Wo | Hinweis |
| --- | --- | --- |
| Erkennungsregeln, Schwelle, Mehrdeutigkeitsabstand, Fallback-Profil | `src/data/analysisRules.ts` (`DEFAULT_ANALYZER_CONFIG`) | `fallback: null` schaltet den Fallback ab |
| Gewichte je Kategorie, Prioritätsmodi, Mindeststufen, Workflows | `src/data/policy.ts` | Änderungen an Gewichten brauchen Review gegen die Evaluation |
| Modellkatalog | `src/models/catalog.ts` | wird beim Start von `src/models/registry.ts` geprüft |

**Neue Regel hinzufügen** – ein Eintrag in `ANALYSIS_RULES`:

```ts
{ id: 'writing-recipe', label: 'Rezeptwunsch', category: 'writing', strength: 3, pattern: /rezept|recipe/iu },
```

- `label` erscheint in der Oberfläche als Begründung.
- Muster ohne `g`- oder `y`-Flag schreiben: Solche Regexe merken sich ihre Position zwischen Aufrufen.
- `validateAnalyzerConfig` (`src/analyzer/config.ts`) prüft beim Start: eindeutige IDs, gültige Kategorien und Stärken, keine Flags `g`/`y`, kein Muster, das auf leeren Text passt, und ob jede Kategorie die Schwelle überhaupt erreichen kann. Bei einem Fehler zeigt die App eine Meldung, statt still falsch zu routen.
- Danach `npm test` ausführen. Die Evaluation in `src/evaluation/cases.ts` zeigt, ob bestehende Fälle kippen.

`analyzePrompt(input, config)` und `deriveRequirements(analysis, config)` nehmen die Konfiguration als Parameter. Ein eigener Regelsatz lässt sich also testen, ohne den Standard zu ändern (Beispiel in `src/router/rules.test.ts`).

**Neues Modell**: Profil in `src/models/catalog.ts` ergänzen. Der Router enthält keine Modellnamen, neue Modelle brauchen keine Codeänderung.

## Projektaufbau

```
src/
  index.html   Einstiegsseite für Vite (nur über den Build oder den Dev-Server lauffähig)
  analyzer/    Regelanalyse, Anforderungen, Konfigurationsprüfung
  router/      Eignung, Scores, Entscheidung und Begründung
  optimizer/   Gliederung des Prompts mit Erhaltungsprüfung
  models/      Demo-Katalog und Katalogprüfung
  data/        Regeln, Richtlinien (Gewichte), Beispiele
  domain/      gemeinsame Typen
  app/         React-Zustand, Dienste, Theme
  components/  Darstellung
  evaluation/  handgeprüfte Routing-Fälle (DE/EN)
```

Die Fachmodule (`analyzer`, `router`, `optimizer`) sind reine Funktionen ohne React und Browser-APIs.

## Grenzen

- Regeln erkennen Formulierungen, nicht Bedeutung. Ungewöhnlich formulierte Aufgaben landen im Fallback oder werden falsch eingeordnet; die angezeigten Signale machen das sichtbar.
- Scores sind heuristische Passung im Demo-Katalog, keine Erfolgswahrscheinlichkeit.
- Die Optimierung ergänzt höchstens eine Überschrift und zeigt fehlende Angaben als Vorschläge. Sie schreibt den Prompt nicht um.
