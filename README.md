# PromptRouter

PromptRouter sagt dir für einen Prompt, **welches Modell aus deinen Abos Claude Pro und ChatGPT Plus** reicht und **welche Reasoning- bzw. Effort-Stufe** du einstellen solltest. Die Empfehlung ist immer die sparsamste Einstellung, die für die Aufgabe genügt; eine stärkere kommt nur, wenn die Aufgabe sie braucht. Dazu liefert die App drei Fassungen deines Prompts (für Claude, neutral, für ChatGPT), ohne deinen Text zu verändern.

Wichtig zur Einordnung:

- **Es wird kein KI-Modell aufgerufen.** Die App sendet nichts ins Netz und führt keine Aufgabe aus. Sie empfiehlt nur; den Prompt kopierst du selbst in claude.ai oder ChatGPT.
- **Die Analyse ist regelbasiert** (Muster mit Punkten), nicht semantisch. Sie versteht Deutsch und Englisch.
- **Die Leistungswerte stammen von Artificial Analysis**, der Verbrauch nur aus den offiziellen Hilfeseiten von Anthropic und OpenAI. Beides steht in `models.json` und wird von Hand gepflegt (siehe unten).

## App starten – Schritt für Schritt

### Variante A: im Browser, ohne Installation

<https://hoikurama.github.io/Router-planner/> öffnen. Die Seite wird bei jedem Push auf `main` neu gebaut (`.github/workflows/static.yml`; in den Repository-Einstellungen muss unter *Pages → Source* „GitHub Actions“ stehen).

### Variante B: auf deinem Rechner

Einmalig vorbereiten:

1. **Node.js installieren:** <https://nodejs.org> öffnen, die Version „LTS“ herunterladen und mit den Standardeinstellungen installieren. Damit kommt auch `npm` mit.
2. **Terminal im Projektordner öffnen:** im Explorer den Ordner `Router planner` öffnen, oben in die Adresszeile klicken, `powershell` eintippen und Enter drücken.
3. **Abhängigkeiten laden:** `npm install` eintippen und Enter drücken. Das dauert beim ersten Mal ein bis zwei Minuten.

Danach jedes Mal, wenn sich der Code oder `models.json` geändert hat:

4. `npm run build` eintippen und Enter drücken. Am Ende steht `✓ built`.
5. Im Ordner `dist` die Datei **`index.html` doppelklicken**. Sie öffnet sich im Browser und funktioniert ohne Server und ohne Internet, weil alles in diese eine Datei eingebettet ist.

Wenn du nur schnell etwas ausprobieren willst, ohne zu bauen: `npm start` öffnet die App unter <http://localhost:5173/>. Das Terminal muss dafür offen bleiben; mit Strg+C beendest du den Server.

**Was nicht geht:** `src/index.html` per Doppelklick öffnen. Diese Datei braucht den Entwicklungsserver und erklärt das auch selbst, statt weiß zu bleiben.

## Bedienung

1. **Prompt eingeben** oder ein Beispiel anklicken und eine Priorität wählen: *Sparsam*, *Ausgewogen* oder *Beste Qualität*.
2. **Analysieren** klicken oder Strg+Enter drücken.
3. **Empfehlung:** Modell, Stufe und Kontingent mit einer Begründung in zwei Sätzen. Darunter stehen: wo du die Einstellung findest, was der Anbieter zum Verbrauch sagt, Warnhinweise und Alternativen, die ebenfalls reichen. „Warum diese Empfehlung?“ zeigt alle geprüften Einstellungen mit Wert und Status.
4. **Varianten:** drei Fassungen des Prompts zum Kopieren. Die passende ist markiert, du kannst jede bearbeiten.
5. **Verlauf:** Suche, Filter nach Anbieter und Kategorie; ein Klick auf einen Eintrag lädt ihn wieder.
6. **Überblick:** wie oft Claude und wie oft ChatGPT empfohlen wurde, auch nach Kontingent.
7. **Einstellungen:** welche Kontingente du nutzt, welchen Anbieter du bevorzugst, wenn beide reichen, Standard-Priorität, Verlauf an/aus, Export und Import.

Ist eine Empfehlung **„vorläufig“**, steht der Grund bei den Hinweisen. Gründe sind zum Beispiel: Verbrauch nicht dokumentiert, Annahme bei der Zuordnung zu Artificial Analysis, Modell im Rollout, Komplexität nicht erkannt.

## Wie die Empfehlung entsteht

```
Prompt → Analyse → Anforderungen (Kategorie, Komplexität 1–5, Tools, Kontextlänge)
       → Messgröße wählen → Schwelle berechnen → leichteste ausreichende Einstellung
```

1. **Messgröße je Aufgabe** (`src/data/policy.ts`, `METRIC_BY_CATEGORY`):
   - Coding → *Terminal-Bench 4.0*
   - Mathematik → *Humanity's Last Exam*
   - alles andere → *AA Intelligence Index*

   Sehr lange Eingaben brauchen zusätzlich mindestens 90 % des besten *AA-LCR*-Werts (Long Context Reasoning).
2. **Schwelle:** bester verfügbarer Wert × Anteil nach Kategorie und Komplexität (`QUALITY_FRACTIONS`) × Prioritätsfaktor. Sparsam ist 0,85, Ausgewogen 1, Beste Qualität nimmt einfach den höchsten Wert. Beispiel: Schreiben mit Komplexität 2 braucht 45 % des besten Werts, Coding mit Komplexität 5 braucht 93 %.
3. **Innerhalb eines Kontingents** gewinnt unter den Einstellungen, die die Schwelle erreichen, das leichtere Modell, bei gleichem Modell die niedrigere Stufe. Die Reihenfolge („weight“, „effortRank“) kommt aus den Anbieterangaben: Haiku < Sonnet < Opus; Luna < GPT-6.1 Sol < Astra; niedrigere Stufen verbrauchen weniger.
4. **Zwischen den Kontingenten** gibt es keinen gemeinsamen Maßstab (siehe Grenzen). Die Reihenfolge ist deshalb eine feste Faustregel:
   1. sicher verfügbar vor unklar
   2. bevorzugter Anbieter
   3. passende Umgebung: Work/Codex zuerst, wenn die Aufgabe Dateien schreiben oder Code ausführen muss, sonst Chat zuerst
   4. Kontingent mit dokumentiertem Verbrauch vor undokumentiertem
   5. leichteres Modell, dann niedrigere Stufe
5. **Nie empfohlen** werden:
   - Modelle außerhalb des Abos (`inPlan: false`, z. B. Claude Fable 5.1)
   - Einstellungen ohne Wert für die entscheidende Messgröße
   - Einstellungen mit unklarer Verfügbarkeit, solange eine sichere reicht

Die Schwellen-Anteile sind eine **Richtlinie von mir, keine Messung**. Wer sie ändern will, passt `QUALITY_FRACTIONS` an und lässt `npm test` laufen: Die handgeprüften Fälle in `src/evaluation/cases.ts` zeigen, was kippt.

## models.json aktualisieren

Alle Modelldaten stehen in **`models.json`** im Projektordner. Die App liest die Datei beim Bauen ein; es gibt **keinen Live-Abruf** im Browser und kein Abrufskript (siehe „Artificial Analysis: Nutzungsbedingungen“).

### Ablauf

1. Auf <https://artificialanalysis.ai/leaderboards/models> bzw. der Modellseite `https://artificialanalysis.ai/models/<slug>` die Werte nachsehen. Der `slug` steht bei jeder Einstellung unter `aa.slug`.
2. In `models.json` die Zahlen ändern und oben `retrieved` (und bei geänderten Quellen deren `retrieved`) auf das heutige Datum setzen, Format `JJJJ-MM-TT`.
3. Bei den Abos die Hilfeseiten aus der Quellenliste prüfen: Sind Modelle dazugekommen oder weggefallen? Haben sich Limits oder Schätzungen geändert?
4. `npm test` ausführen. Der Test „accepts the shipped catalog“ prüft die Datei; Fehler werden auf Deutsch mit Fundstelle gemeldet.
5. `npm run build` ausführen und `dist/index.html` neu öffnen.

Ist die Datei ungültig, **routet die App nicht** und zeigt stattdessen die Fehler an. So rechnet sie nicht mit kaputten Werten weiter.

### Felder

| Feld | Bedeutung |
| --- | --- |
| `retrieved`, `sources.*.retrieved` | Abrufdatum `JJJJ-MM-TT`; erscheint in der App als „Stand“ |
| `sources` | Alle Quellen mit Titel und https-URL. Jede andere Angabe verweist per ID hierauf |
| `metrics` | Die vier Messgrößen mit Bezeichnung und dem Feldnamen bei Artificial Analysis |
| `pools` | Kontingente: `kind` (`chat` oder `workspace`), `usageDocumentation` (`ordinal`: nur Reihenfolge bekannt; `estimates`: Schätzungen; `none`: nichts dokumentiert), `usageSummary`, `appUrl` |
| `models[].weight` | Verbrauchsrang im Kontingent, 1 = am leichtesten. Nur innerhalb desselben Kontingents vergleichbar |
| `models[].inPlan` | `false` = nicht im Abo enthalten, wird nie empfohlen |
| `models[].planNote` | Hinweis zur Verfügbarkeit (z. B. Rollout). Macht eine Empfehlung vorläufig |
| `models[].usage` | Was der Anbieter zum Verbrauch sagt; `estimate` nur, wenn er Zahlen nennt, sonst `null` |
| `settings[].effortRank` | 0 (kein Reasoning) bis 5 (Max), Reihenfolge innerhalb des Modells |
| `settings[].availability` | `yes` oder `unclear`. Bei `unclear` bitte `note` mit Begründung |
| `settings[].mapping` | Annahme bei der Zuordnung zur Variante bei Artificial Analysis. Macht eine Empfehlung vorläufig |
| `settings[].aa` | `intelligence` (0–100), `coding`, `math`, `longContext` (je 0–1), Preise und Tempo. **Fehlt ein Wert, `null` eintragen, nicht schätzen.** `estimated: true`, wenn Artificial Analysis den Wert selbst als Schätzung markiert |

**Neues Modell:** einen Eintrag unter `models` mit mindestens einer Einstellung ergänzen. Der Router enthält keine Modellnamen; neue Modelle brauchen keine Codeänderung.

### Artificial Analysis: Nutzungsbedingungen

Die [Nutzungsbedingungen](https://artificialanalysis.ai/terms-of-use) erlauben die Website nur für den **persönlichen, nicht kommerziellen Gebrauch**. Verboten sind dort Skripte, die Daten automatisiert abfragen oder auslesen (Scraping), sowie das Vervielfältigen, Verbreiten oder Weiterveröffentlichen von Inhalten, soweit die Bedingungen es nicht ausdrücklich erlauben. Deshalb gilt für dieses Projekt:

- **Kein Scraper.** Werte von Hand nachsehen oder die [kostenlose API](https://artificialanalysis.ai/api-reference) nutzen. Für die API brauchst du ein Konto und einen eigenen Schlüssel. Sie ist auf 1.000 Anfragen pro Tag begrenzt und verlangt eine Quellenangabe mit Link auf artificialanalysis.ai. Den Schlüssel nicht in Browser-Code einbauen, sondern höchstens in ein lokales Skript, das `models.json` schreibt. Ob die API alle vier Messgrößen liefert, habe ich nicht geprüft: Das Beispiel in der Doku zeigt den Intelligence Index und HLE, aber kein Terminal-Bench 4.0 und kein AA-LCR.
- **Nur für dich.** Das öffentliche Repository und die GitHub-Pages-Seite veröffentlichen die Zahlen aus `models.json` mit. Das ist durch die Bedingungen vermutlich nicht gedeckt. Sicherer ist ein privates Repository und die lokale Datei `dist/index.html`.

## Gespeicherte Daten

Alles bleibt in deinem Browser (`localStorage`), nichts geht ins Netz.

| Schlüssel | Inhalt |
| --- | --- |
| `promptrouter:v1` | `{ version: 1, history, settings, lastVariant }`: Verlauf (höchstens 100 Einträge), Einstellungen, zuletzt gewählte Variante |
| `promptrouter-theme` | hell oder dunkel |

- Jeder Zugriff ist abgesichert. Ist der Speicher gesperrt (privates Fenster, Datei als `data:`-URL), voll oder kaputt, läuft die App mit den Standardwerten weiter und zeigt einen Hinweis.
- Einzelne fehlerhafte Einträge werden verworfen, der Rest bleibt erhalten.
- Beschädigte Daten oder Daten einer anderen Version lädt die App nicht. Vorher kopiert sie sie unter `promptrouter:backup`, damit das nächste Speichern nichts unbemerkt löscht.
- **Export** speichert alles als JSON-Datei.
- **Import** führt den Verlauf nach ID zusammen und übernimmt die Einstellungen aus der Datei.
- **Verlauf löschen** fragt vorher nach. Die Einstellungen bleiben.
- Der Speicher gehört zur Adresse der Seite. Die Online-Version, `localhost:5173` und `dist/index.html` haben also jeweils einen eigenen Verlauf. Mit Export und Import überträgst du ihn.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm start` / `npm run dev` | Entwicklungsserver auf Port 5173 (mit bzw. ohne Browserfenster) |
| `npm run build` | Typprüfung und Build nach `dist/index.html` |
| `npm run preview` | Den Build über einen lokalen Server ansehen |
| `npm test` | Alle Tests (Vitest) |
| `npm run test:watch` | Tests im Watch-Modus |
| `npm run evaluate` | Nur die handgeprüften Routing-Fälle |
| `npm run typecheck` / `npm run lint` | TypeScript und ESLint |

## Projektaufbau

```
models.json        Modelle, Kontingente, Benchmarks, Quellen (von Hand gepflegt)
src/
  index.html       Einstiegsseite für Vite
  analyzer/        Regelanalyse, Anforderungen, Konfigurationsprüfung
  router/          route.ts (Auswahl), explain.ts (Begründung, Hinweise), workflow.ts
  optimizer/       optimize.ts (neutrale Fassung), variants.ts (Claude/ChatGPT-Fassung)
  models/          catalog.ts lädt models.json, validate.ts prüft sie
  data/            Analyseregeln, Schwellen (policy.ts), Beispiele
  domain/          gemeinsame Typen
  app/             App, Dienste, Speicher (storage.ts), Verlauf (history.ts), Theme
  components/      Karten der Oberfläche
  styles/          base, layout, cards, recommendation, side
  evaluation/      handgeprüfte Fälle (Deutsch und Englisch)
```

`analyzer`, `router` und `optimizer` sind reine Funktionen ohne React und ohne Browser-APIs.

**Analyseregeln anpassen:** `src/data/analysisRules.ts`. `validateAnalyzerConfig` prüft beim Start eindeutige IDs, gültige Stärken und Muster ohne `g`/`y`-Flag. Danach `npm test` ausführen.

## Quellen

Stand aller Angaben: 4. Oktober 2026.

**Benchmarks**
- Artificial Analysis – LLM Leaderboard: <https://artificialanalysis.ai/leaderboards/models>
- Artificial Analysis – Modellseiten: `https://artificialanalysis.ai/models/<slug>`
- Artificial Analysis – Nutzungsbedingungen: <https://artificialanalysis.ai/terms-of-use>
- Artificial Analysis – API-Dokumentation: <https://artificialanalysis.ai/api-reference>

**Claude Pro (Anthropic)**
- What is the Pro plan? (Limits, Reihenfolge des Verbrauchs): <https://support.claude.com/en/articles/8325606-what-is-the-pro-plan>
- Choosing the right Claude model (Haiku leicht, Sonnet moderat, Opus stark): <https://academy.claude.com/tutorials/choosing-the-right-claude-model>
- Change the model, effort, and thinking settings (Effort-Stufen): <https://support.claude.com/en/articles/8664678-change-the-model-effort-and-thinking-settings>
- Claude Fable models on your plan (Fable nicht im Pro-Kontingent): <https://support.claude.com/en/articles/15424964-claude-fable-models-on-your-plan>
- Context window on paid plans: <https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans>

**ChatGPT Plus (OpenAI)**
- GPT-5.6 and GPT-6 Pro in ChatGPT (Chat-Stufen, Thinking-Limit): <https://help.openai.com/en/articles/20001354-gpt-56-and-gpt-6-pro-in-chatgpt>
- Managing usage with GPT-6 Astra in Work and Codex (Schätzungen pro 5 Stunden): <https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex>
- ChatGPT Learn – Models (Luna, GPT-6.1 Sol im Rollout, Astra Extra High): <https://learn.chatgpt.com/docs/models>
- What is ChatGPT Plus?: <https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus>

## Grenzen

- **Kein gemeinsamer Verbrauchsmaßstab.** Claude Pro, ChatGPT-Chat und ChatGPT Work/Codex haben getrennte Kontingente. Anthropic nennt nur eine Reihenfolge, OpenAI für den Chat gar keine Zahlen und für Work/Codex Schätzspannen. Ob Sonnet Low „sparsamer“ ist als Luna Medium, lässt sich daraus nicht ableiten. Die App sagt das bei jeder Empfehlung dazu.
- **Benchmarks sind Stellvertreter.** Terminal-Bench misst agentisches Coding im Terminal, HLE Expertenfragen. Für eine einfache Rechenaufgabe ist HLE sehr streng; deshalb liegt der Anteil bei Komplexität 1 niedrig.
- **Zuordnungen sind teils Annahmen.** Die Chat-Stufen von GPT-5.6 Sol und „Extended an/aus“ bei Haiku 4.5 haben keine dokumentierte Entsprechung bei Artificial Analysis. Solche Empfehlungen sind als vorläufig markiert.
- **Regeln erkennen Formulierungen, nicht Bedeutung.** Ungewöhnlich formulierte Aufgaben landen im Fallback oder in der falschen Kategorie; die Analyse zeigt, welche Regeln gegriffen haben.
- **Die Varianten** fügen nur einen Rahmen hinzu (XML-Tags bzw. Überschriften und wenige Ausgabehinweise). Dein Text bleibt Zeichen für Zeichen erhalten; das prüft die App bei jeder Variante.
