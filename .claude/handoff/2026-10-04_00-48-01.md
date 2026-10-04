# Sitzungs-Handoff

_PreCompact (auto) – 2026-10-04 00:48_

## Stand

- **Veröffentlicht (4399042):** App öffnet lokal (`dist/index.html`) und auf GitHub Pages. `index.html` liegt jetzt in `src/`, überflüssige Dateien sind entfernt, Deploy-Workflow läuft.
- **Neuer Router:** Der fiktive Demo-Katalog ist ersetzt. `models.json` enthält echte Modelle mit Quelle und Abrufdatum (04.10.2026). Neu: `src/models/validate.ts`, `catalog.ts`, `src/router/workflow.ts`, `explain.ts`, `route.ts`. Die Nutzung wird nur über offizielle Abo-Limits bewertet, Undokumentiertes heißt „unklar“. `deriveRequirements` liefert jetzt auch die Komplexität.
- **Drei Prompt-Varianten:** Claude (XML), Neutral (`# Aufgabe`), ChatGPT (Markdown) in `src/optimizer/variants.ts`.
- **Speicher:** `storage.ts`, `history.ts`, `usePersistentState.ts` (versionierter Key, try/catch, Export/Import, Verlauf löschen).
- **Dashboard:** Karten-Komponenten (Prompt, Empfehlung, Details, Varianten, Verlauf, Nutzung, Einstellungen), `App.tsx` umgebaut, CSS auf 5 Dateien unter `src/styles/` verteilt.
- **Tests:** 204 Tests grün, Typprüfung und ESLint ohne Befund, Build erzeugt eine einzelne `dist/index.html`. Die Router-Tests schlagen an, wenn die Schwelle absichtlich kaputt gemacht wird.
- **Browser:** Desktop-Layout stimmt. Bei 375 px kein horizontales Scrollen.

## Offen

- Browsertest abschließen: Sichtcheck (Screenshots) lief zuletzt, Eingabe per Tool kam zunächst nicht bei React an; Konsole prüfen, Dark Mode und Kopierfunktionen testen.
- README neu schreiben (Installation, Start, `models.json` aktualisieren, Quellen). Sie beschreibt noch den alten Demo-Router.
- Footer-Text „Keine Prompt-Speicherung“ anpassen, falls noch vorhanden.
- Änderungen (u. a. `cacheDir` in `vite.config.ts`) sind noch nicht committet.
- Abschlussbericht: Änderungen, Start-Anleitung für Nicht-Entwickler, offene Fragen und Risiken.

## Notizen

- **Risiko Artificial Analysis:** Die Nutzungsbedingungen erlauben nur persönliche, nicht kommerzielle Nutzung und verbieten Kopieren und Scraping. Die 31 Modellseiten wurden per Browser-JS abgerufen. Das öffentliche Repo mit AA-Zahlen ist ein Risiko, offen ist ein privates Repo oder die offizielle API. Kein Scraper für Updates.
- Fable 5/5.1 ist in Claude Pro nicht im Limit, daher ausgeschlossen. GPT-6 Astra Extra High/Max sind für Plus unklar.
- Offene Frage an den Nutzer: Handoff-Buttons oder API-Keys sind weiterhin nicht entschieden.
- Die Git-Bash-Pfadumwandlung braucht `MSYS_NO_PATHCONV=1`. Kein `taskkill` auf alle Node-Prozesse.
