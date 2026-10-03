# PromptRouter

## Goal

Lokales React-/TypeScript-MVP für regelbasierte Prompt-Analyse, sichere Strukturierung und erklärbares Modell-/Workflow-Routing.

## Current State

02.10.2026: Lauffähig und geprüft. `dist/index.html` funktioniert per Doppelklick (JS/CSS eingebettet), `npm start` über den Entwicklungsserver. 172 Tests grün, Evaluation 72/72 akzeptabel, 0 harte Verletzungen. Typecheck, Lint und `npm audit` sauber. In Chrome geprüft: Desktop und 390 px, hell und dunkel, Konsole ohne Fehler, keine externen Requests.

## Important Decisions

- Weiße Seite: Ursache war das Öffnen von `dist/index.html` über `file://` (absolute `/assets/`-Pfade und von Chrome blockierte Modul-Skripte). Der Build bettet deshalb alles in eine Datei ein.
- rules-v2 / routing-v2: Regelsatz als injizierbare, geprüfte `AnalyzerConfig`; Regel-Sicherheit 0–1; neue Kategorie Planung.
- **Abweichung von der Spezifikation:** Unbekannte Aufgaben mit echtem Text erhalten eine als „Fallback“ markierte, immer vorläufige Empfehlung (Profil Reasoning + Schreiben), statt ganz ohne Empfehlung zu bleiben. In einer Stichprobe von 25 Alltagsprompts blieben vorher 11 ohne Empfehlung. Abschaltbar mit `fallback: null`.

## Relevant Facts

Node 24.19.0, npm 11.17.0, Vitest 4.1.11. Policy Fast 40/40/20, Balanced 60/20/20, Best 100/0/0 (Qualität/Tempo/Kosten). Katalogwerte sind fiktiv.

## Open Questions

- Über 43 Prompts × 3 Modi sind 84 von 123 Empfehlungen (68 %) vorläufig, 60 davon allein wegen der Regel „≤ 5 Punkte Abstand“. Das ist Policy, schwächt aber das Signal „vorläufig“.
- Soll der Demo-Katalog durch echte, dokumentierte Modellprofile ersetzt werden?

## Next Steps

Siehe Abschlussbericht: Regel-Editor mit Live-Test, echte Modellprofile, optionale Ausführung über einen Backend-Proxy.
