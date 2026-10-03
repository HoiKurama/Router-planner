export interface ExamplePrompt { id: string; label: string; text: string }

export const EXAMPLES: readonly ExamplePrompt[] = [
  { id: 'arithmetic', label: 'Einfache Rechnung', text: 'Berechne 17 * 24.' },
  { id: 'proof', label: 'Komplexe Mathematik', text: 'Beweise den Satz, dass jede stetige Funktion auf einem kompakten Intervall gleichmäßig stetig ist. Nutze keine Differentialrechnung. Prüfe die Randbedingungen und erkläre, weshalb die Kompaktheit notwendig ist.' },
  { id: 'react', label: 'React-Projekt', text: 'Baue ein React-Projekt mit TypeScript für eine lokale Aufgabenliste. Aufgaben sollen erstellt, bearbeitet und abgehakt werden können. Speichere sie im Browser. Die Oberfläche muss responsive sein. Ergänze Tests für die wichtigsten Interaktionen.' },
  { id: 'writing', label: 'Text verbessern', text: 'Verbessere diesen Text für eine freundliche, professionelle E-Mail. Behalte alle Fakten und die Uhrzeit bei:\n\n"Hallo, ich komme morgen erst um 10:30 Uhr. Der Zug fällt aus. Können wir den Termin verschieben?"' },
  { id: 'research', label: 'Aktuelle Recherche', text: 'Recherchiere die aktuellen Entwicklungen beim Ausbau erneuerbarer Energien in Deutschland. Vergleiche die neuesten Zahlen mit dem Vorjahr. Nutze verlässliche Quellen und nenne das Datum der Daten.' },
  { id: 'file', label: 'Datei analysieren', text: 'Analysiere meine CSV-Datei mit monatlichen Umsätzen. Identifiziere Trends, fehlende Werte und Ausreißer. Behalte die Originaldaten unverändert und liefere eine kurze Zusammenfassung mit nachvollziehbaren Kennzahlen.' },
  { id: 'migration', label: 'Coding-Migration', text: 'Migriere die gesamte Codebase eines TypeScript-Projekts auf eine neue Datenzugriffsschicht. Zuerst analysiere die Abhängigkeiten, dann erstelle einen Migrationsplan und implementiere die Änderungen. Erhalte die API-Kompatibilität, ergänze Integrationstests und dokumentiere einen Rollback. Verändere keine öffentlichen Schnittstellen.' },
]
