import type { Category } from '../domain/types'

export interface LabelledPrompt { text: string; category: Category | null }

/**
 * Two sets of everyday prompts, labelled by hand. `null` means no specific category fits and the
 * general fallback route is correct.
 *
 * TUNING: rules-v3 was developed against these (43 % → 100 %). Its hit rate says nothing about
 * generalization any more; it only guards against regressions.
 *
 * HELD_OUT: written after rules-v3 was finished and measured once, without changing a rule
 * afterwards. This is the honest number. If you change a rule because of a held-out prompt,
 * move the prompt to TUNING and write a fresh one; otherwise the set silently becomes training data.
 */
export const TUNING: readonly LabelledPrompt[] = [
  // coding
  { text: 'Kannst du mir helfen, meine Express-App mit einer PostgreSQL-Datenbank zu verbinden?', category: 'coding' },
  { text: 'My Jest tests fail with "Cannot find module". How do I fix that?', category: 'coding' },
  { text: 'Schreib mir ein Bash-Skript, das alle .log-Dateien älter als 7 Tage löscht.', category: 'coding' },
  { text: 'Convert this JavaScript function to TypeScript with proper types.', category: 'coding' },
  { text: 'Mein Python-Programm wirft einen IndexError in Zeile 12.', category: 'coding' },
  { text: 'Optimiere diese SQL-Abfrage, sie ist zu langsam.', category: 'coding' },
  { text: 'Add dark mode support to my Next.js website.', category: 'coding' },
  { text: 'Wie kann ich in Git einen Commit rückgängig machen?', category: 'coding' },
  { text: 'Create a REST endpoint in Go that returns the current user.', category: 'coding' },
  { text: 'Füge meiner React-Komponente eine Ladeanzeige hinzu.', category: 'coding' },
  // math
  { text: 'Wie viel sind 15 % von 240?', category: 'math' },
  { text: 'What is the derivative of x^3 * sin(x)?', category: 'math' },
  { text: 'Löse das Gleichungssystem 2x + y = 7 und x - y = 2.', category: 'math' },
  { text: 'Calculate the area of a circle with radius 4 cm.', category: 'math' },
  { text: 'Wie groß ist die Wahrscheinlichkeit, mit zwei Würfeln eine 7 zu werfen?', category: 'math' },
  { text: 'Rechne 3/4 + 5/6 aus.', category: 'math' },
  // writing
  { text: 'Formuliere eine höfliche Absage für ein Vorstellungsgespräch.', category: 'writing' },
  { text: 'Translate the following paragraph into French: "We are open on Sundays."', category: 'writing' },
  { text: 'Schreib einen kurzen LinkedIn-Post über meinen neuen Job.', category: 'writing' },
  { text: 'Give me 10 name ideas for a coffee shop.', category: 'writing' },
  { text: 'Erstelle eine Präsentation über erneuerbare Energien für die 8. Klasse.', category: 'writing' },
  { text: 'Proofread my cover letter and make it sound more confident.', category: 'writing' },
  { text: 'Kürze diesen Absatz auf die Hälfte: "Unser Verein wurde 1990 gegründet und hat heute 300 Mitglieder."', category: 'writing' },
  { text: 'Write a short bedtime story about a dragon who is afraid of the dark.', category: 'writing' },
  { text: 'Sammle Ideen für ein Motto unserer Abschlussfeier.', category: 'writing' },
  // research
  { text: 'Was sind die aktuellen Zinsen für Baufinanzierungen in Deutschland?', category: 'research' },
  { text: 'Find recent studies on the effect of intermittent fasting, with sources.', category: 'research' },
  { text: 'Wer hat gestern das Spiel Bayern gegen Dortmund gewonnen?', category: 'research' },
  { text: 'Look up the current population of Tokyo.', category: 'research' },
  { text: 'Welche neuen Gesetze treten dieses Jahr in Kraft?', category: 'research' },
  // learning
  { text: 'Was ist der Unterschied zwischen RAM und SSD?', category: 'learning' },
  { text: 'Explain the difference between weather and climate.', category: 'learning' },
  { text: 'Kannst du mir erklären, wie Photosynthese funktioniert?', category: 'learning' },
  { text: 'Help me understand how compound interest works.', category: 'learning' },
  { text: 'Erkläre mir den Satz des Pythagoras wie einem Zehnjährigen.', category: 'learning' },
  { text: 'Quiz me on the capitals of South America.', category: 'learning' },
  { text: 'What does the word "serendipity" mean?', category: 'learning' },
  // dataAnalysis
  { text: 'Hier sind meine Verkaufszahlen pro Monat. Welche Trends erkennst du? Jan 120, Feb 135, Mär 160', category: 'dataAnalysis' },
  { text: 'Analyze this survey data and tell me which age group is most satisfied.', category: 'dataAnalysis' },
  { text: 'Werte die Excel-Tabelle mit unseren Ausgaben aus.', category: 'dataAnalysis' },
  { text: 'Calculate the correlation between study hours and grades in my dataset.', category: 'dataAnalysis' },
  // reasoning
  { text: 'Soll ich das Jobangebot in München annehmen oder in Berlin bleiben?', category: 'reasoning' },
  { text: 'What are the pros and cons of renting versus buying a flat?', category: 'reasoning' },
  { text: 'Wäge ab, ob sich eine Wärmepumpe für unser Haus lohnt.', category: 'reasoning' },
  { text: 'Which is better for a beginner: a road bike or a gravel bike?', category: 'reasoning' },
  // planning
  { text: 'Erstelle mir einen Trainingsplan für einen Halbmarathon in 12 Wochen.', category: 'planning' },
  { text: 'Help me plan a birthday party for 20 people on a small budget.', category: 'planning' },
  { text: 'Plane eine Woche Mahlzeiten für eine vierköpfige Familie.', category: 'planning' },
  { text: 'Make a study schedule for my exams in three weeks.', category: 'planning' },
  { text: 'Organisiere einen Teamausflug für 15 Personen im Juni.', category: 'planning' },
  // general: the fallback is the right answer
  { text: 'Hallo, wie geht es dir?', category: null },
  { text: 'Tell me a joke.', category: null },
  { text: 'Wie heißt die Hauptstadt von Australien?', category: null },
]

export const HELD_OUT: readonly LabelledPrompt[] = [
  // coding
  { text: 'Wieso bekomme ich bei npm install einen Fehler wegen fehlender Berechtigungen?', category: 'coding' },
  { text: 'Write unit tests for my login service in Java.', category: 'coding' },
  { text: 'Ich möchte, dass mein Discord-Bot auf Nachrichten mit einem Emoji reagiert. Wie programmiere ich das?', category: 'coding' },
  { text: 'Refaktoriere diese Klasse, sie ist über 800 Zeilen lang.', category: 'coding' },
  { text: 'Why is my CSS grid not centering the items?', category: 'coding' },
  { text: 'Generate a Dockerfile for a Flask application.', category: 'coding' },
  { text: 'Was macht dieser Code? ```py\nprint(sum(range(10)))\n```', category: 'coding' },
  { text: 'Hilf mir, ein Excel-Makro in VBA zu schreiben, das leere Zeilen entfernt.', category: 'coding' },
  // math
  { text: 'Was ist 12 hoch 3?', category: 'math' },
  { text: 'Solve for x: 3x - 7 = 11', category: 'math' },
  { text: 'Wie berechne ich das Volumen eines Zylinders mit r = 3 und h = 10?', category: 'math' },
  { text: 'Is 221 a prime number?', category: 'math' },
  { text: 'Vereinfache den Bruch 84/126.', category: 'math' },
  { text: 'Find the integral of 2x from 0 to 5.', category: 'math' },
  // writing
  { text: 'Schreibe eine Glückwunschkarte zur Hochzeit meiner Schwester.', category: 'writing' },
  { text: 'Make this email sound less passive-aggressive: "As I already said twice, please send the report."', category: 'writing' },
  { text: 'Verfasse eine Produktbeschreibung für handgemachte Seife.', category: 'writing' },
  { text: 'Come up with a catchy title for my podcast about gardening.', category: 'writing' },
  { text: 'Formuliere meine Stichpunkte als zusammenhängenden Text: Projekt fertig, Budget eingehalten, Team zufrieden.', category: 'writing' },
  { text: 'Write a limerick about a cat who loves Mondays.', category: 'writing' },
  { text: 'Übersetze bitte ins Spanische: "Wo ist der Bahnhof?"', category: 'writing' },
  // research
  { text: 'Wie ist das Wetter morgen in Hamburg?', category: 'research' },
  { text: 'What happened in the news this week regarding the Mars mission?', category: 'research' },
  { text: 'Suche mir aktuelle Testberichte zu E-Bikes unter 2000 Euro.', category: 'research' },
  { text: 'Gather sources on the history of the Berlin Wall for my essay.', category: 'research' },
  { text: 'Wie steht der DAX gerade?', category: 'research' },
  // learning
  { text: 'Ich verstehe Rekursion nicht. Kannst du es mit einem Beispiel zeigen?', category: 'learning' },
  { text: 'Explain like I am five: how do vaccines work?', category: 'learning' },
  { text: 'Was versteht man unter Opportunitätskosten?', category: 'learning' },
  { text: 'Teach me the basics of music theory.', category: 'learning' },
  { text: 'Warum ist der Himmel blau?', category: 'learning' },
  { text: 'How does a blockchain actually work?', category: 'learning' },
  // dataAnalysis
  { text: 'Here is a table of website visits per day. Which weekday performs best?', category: 'dataAnalysis' },
  { text: 'Fasse die wichtigsten Kennzahlen aus unserem Quartalsbericht als Tabelle zusammen und berechne die Wachstumsraten.', category: 'dataAnalysis' },
  { text: 'Clean this dataset: remove duplicates and fill missing ages with the median.', category: 'dataAnalysis' },
  { text: 'Visualisiere die Umfrageergebnisse als Balkendiagramm.', category: 'dataAnalysis' },
  // reasoning
  { text: 'Lohnt sich ein Elektroauto, wenn ich nur 5000 km im Jahr fahre?', category: 'reasoning' },
  { text: 'Help me decide between two job offers: one pays more, the other is remote.', category: 'reasoning' },
  { text: 'Ist es sinnvoller, Schulden zu tilgen oder zu investieren?', category: 'reasoning' },
  { text: 'Should we use a monorepo or separate repositories for our three services?', category: 'reasoning' },
  // planning
  { text: 'Erstelle einen Umzugsplan für die nächsten vier Wochen.', category: 'planning' },
  { text: 'Plan my week: I have two exams, a dentist appointment and football training.', category: 'planning' },
  { text: 'Wie sollte ich meinen Tag strukturieren, um produktiver zu sein?', category: 'planning' },
  { text: 'Create an onboarding checklist for new employees.', category: 'planning' },
  { text: 'Organize a 2-day workshop agenda for our product team.', category: 'planning' },
  // general
  { text: 'Erzähl mir einen Witz über Informatiker.', category: null },
  { text: 'Who painted the Mona Lisa?', category: null },
  { text: 'Danke, das hat mir geholfen!', category: null },
  { text: 'Wie viele Einwohner hat Frankreich?', category: null },
  { text: 'Good morning!', category: null },
]
