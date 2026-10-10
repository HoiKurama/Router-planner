# PromptRouter

Web-App für Darren: empfiehlt zu einem Prompt das sparsamste Modell und die Effort-Stufe aus
Claude Pro und ChatGPT Plus und liefert drei Fassungen des Prompts. Ruft kein Modell auf.
Eigenes Git-Repo `HoiKurama/Router-planner`, öffentlich, mit GitHub Pages.
Pfade hier gelten relativ zu diesem Ordner, Befehle starten im Vault: `projekte/router-planner/…`.
Projektstand steht nur in gedaechtnis/projekt-router-planner.md.

## Ordner
- src/: React 19 und TypeScript mit Vite. Aufbau steht in der README unter „Projektaufbau“.
- models.json: Modelle, Kontingente, Benchmarks und Quellen, von Hand gepflegt
- dist/: Build, eine einzige `index.html`, die per Doppelklick ohne Server läuft. Nicht versioniert.
- .github/workflows/: `static.yml` baut und veröffentlicht bei jedem Push auf main, `ci.yml` prüft PRs.

## Regeln
- Sprache: Oberfläche und README Deutsch, Code und Kommentare Englisch.
- Prüfskript: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Alle vier müssen
  ohne Befund durchlaufen, bevor etwas committet wird. Routing-Quote: `npm run evaluate`.
- `npm` mit `--prefix projekte/router-planner` starten, nicht mit `cd`.
- Werte von Artificial Analysis in `models.json` nur von Hand nachtragen. Nie einen Scraper oder
  Browser-Skripte zum Abrufen schreiben. Gründe: gedaechtnis/promptrouter-aa-daten.md im Vault.
- Fehlt ein Messwert: `null` eintragen, nicht schätzen. Verbrauch nur aus offiziellen Hilfeseiten.
- `analyzer/`, `router/` und `optimizer/` bleiben reine Funktionen ohne React und Browser-APIs.
- Analyseregeln mit `rx()` schreiben. Wird eine Regel wegen eines Held-out-Prompts geändert, wandert
  der Prompt ins Tuning-Set und ein neuer kommt ins Held-out-Set (README, Abschnitt „Grenzen“).
- Push nur, wenn Darren es in der Sitzung sagt: Jeder Push auf main geht sofort online.
