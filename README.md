# Claude Code Mods

Drei Mods für Claude Code.

## modell-sparen

Schickt Übersetzen, Zusammenfassen und Umformulieren automatisch an Haiku, damit dein Limit nicht für Kleinkram draufgeht.

- Claude nutzt dafür von selbst das Werkzeug `einfach`.
- `/haiku übersetze ins Englische: Hallo` gibt eine Aufgabe direkt an Haiku.
- `/haiku` ohne Text zeigt, wie viele Aufgaben Haiku schon übernommen hat.

## dashboard

Ein Bereich neben dem Chat mit zwei Listen: **To-dos** und **Noch antworten**.

- Einträge tippst du direkt im Bereich ein. Ein Klick auf einen Eintrag hakt ihn ab.
- Befehle: `/todo …`, `/antworten Max – Angebot`, `/uebersicht` (öffnet den Bereich).
- Claude kann selbst Einträge machen, zum Beispiel: „Merk dir, dass ich Max noch antworten muss.“
- Die Listen bleiben über Sitzungen hinweg erhalten.

## chat-team

Gibt jedem Chat eine Rolle.

- `/rolle chef`, `/rolle recherche`, `/rolle entwurf` oder `/rolle aus`.
- Über dem Eingabefeld steht die aktuelle Rolle, mit Knöpfen zum Wechseln.
- Als Chef verteilt Claude die Arbeit an die Helfer `chat-team:recherche` (Web und Dateien, nur lesend) und `chat-team:entwurf` (schreibt Texte) und schreibt anderen Chats mit Rolle über SendMessage.

## Installation

In einer Claude-Code-Sitzung im Terminal:

```
/plugin install modell-sparen --marketplace christophdanapfel/claude-mods
/plugin install dashboard --marketplace christophdanapfel/claude-mods
/plugin install chat-team --marketplace christophdanapfel/claude-mods
```

Bei der Frage `Add marketplace?` mit `y` bestätigen, dann den Bereich (user) mit Enter wählen.

Aus einer Shell:

```
claude plugin install modell-sparen --marketplace christophdanapfel/claude-mods
claude plugin install dashboard --marketplace christophdanapfel/claude-mods
claude plugin install chat-team --marketplace christophdanapfel/claude-mods
```

In der Desktop-App: neben dem Eingabefeld auf **+** klicken, dann **Plugins** → **Add marketplace** mit `christophdanapfel/claude-mods`, danach **Add plugin**.

Jede Mod lässt sich einzeln installieren.
