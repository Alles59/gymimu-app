# GymIMU Training MVP

Mobile-first Web-Bluetooth-App für ein Fitness-IMU-Modul an Kraftgeräten. Die
App verwaltet Übungen, speichert pro Übung eine Referenz und mehrere
Trainingssätze und berechnet lokale Bewegungsmetriken direkt im Browser.

Es werden ausschließlich HTML, CSS und Vanilla JavaScript verwendet. Es gibt
kein Backend, kein Login, kein Build-System und keine externen Bibliotheken.

## Lokal starten

Im Projektordner:

```bash
python -m http.server 8000
```

Anschließend im Browser öffnen:

```text
http://localhost:8000
```

`localhost` wird von Browsern als sicherer Kontext behandelt. Deshalb kann Web
Bluetooth dort grundsätzlich verwendet werden. Eine normale Netzwerkadresse wie
`http://192.168.1.20:8000` ist dagegen kein sicherer Kontext. Auf einem anderen
Gerät funktioniert Web Bluetooth daher nur zuverlässig über HTTPS.

Der Demo-Modus funktioniert auch ohne Bluetooth-Gerät.

## Auf Android Chrome über GitHub Pages testen

1. Neues GitHub-Repository anlegen.
2. `index.html`, `style.css`, `app.js` und `README.md` in den Root-Ordner laden.
3. In GitHub **Settings → Pages** öffnen.
4. Unter **Build and deployment** die Option **Deploy from a branch** wählen.
5. Branch `main` und Ordner `/ (root)` auswählen und speichern.
6. Die veröffentlichte Adresse in Chrome auf Android öffnen:

   ```text
   https://DEIN-NAME.github.io/DEIN-REPOSITORY/
   ```

7. Bluetooth aktivieren und Chrome bei Bedarf die Berechtigung für Geräte in
   der Nähe geben.
8. In der App **Connect BLE** drücken und `GymIMU` auswählen.

Der Bluetooth-Auswahldialog muss immer durch einen direkten Button-Klick
ausgelöst werden.

## Typischer Ablauf

1. Unter **Übungen** eine Übung anlegen und auswählen.
2. Unter **Aufnahme** Bluetooth verbinden oder den Demo-Modus starten.
3. Eine saubere Ausführung als **Referenzaufnahme** aufnehmen und speichern.
4. Einen oder mehrere **Trainingssätze** aufnehmen und speichern.
5. Unter **Analyse** Kurven, Metriken, Scores und Feedback vergleichen.
6. Unter **Daten** CSV- oder JSON-Dateien exportieren.

Alle Daten liegen unter dem LocalStorage-Schlüssel
`gymimu-training-mvp-v1`. Die maximale Datenmenge hängt vom Browser ab.

## Demo-Modus

Der Demo-Modus erzeugt alle 50 ms künstliche Sensordaten und leitet sie durch
denselben Parser wie echte BLE-Notifications. Das Format ist also identisch.

Verfügbare Szenarien:

- **Saubere Referenz:** gleichmäßige Wiederholungen
- **Zu schnell:** kürzere Wiederholungsdauer
- **Verkürzte Amplitude:** kleinerer Bewegungsausschlag
- **Ruckartige Bewegung:** zusätzliche Impulse und mehr Signalrauschen
- **Ermüdung gegen Satzende:** sinkende Amplitude, langsameres Tempo und mehr
  Unruhe im Verlauf

Für einen aussagekräftigen Test empfiehlt sich zuerst eine saubere
Demo-Referenz und danach ein Satz mit einem abweichenden Szenario.

## BLE-Konfiguration

Gerätename:

```text
GymIMU
```

UUIDs:

```text
Service:  12345678-1234-5678-1234-56789abcdef0
Data:     12345678-1234-5678-1234-56789abcdef1
Control:  12345678-1234-5678-1234-56789abcdef2
```

Die Data Characteristic muss Notifications als UTF-8-Zeilen senden:

```text
timestamp_ms,ax,ay,az,gx,gy,gz
```

Beispiel:

```text
12345,0.02,0.98,0.05,1.2,-0.3,0.1
```

Beim Start einer Aufnahme sendet die App `START\n`, beim Stoppen `STOP\n` als
UTF-8 an die Control Characteristic.

## Analyse

Die Rep-Erkennung nutzt eine geglättete, von einem langsamen Mittelwert
bereinigte Beschleunigungsmagnitude, eine adaptive Schwelle und einen
Mindestabstand von 500 ms. Berechnet werden unter anderem:

- Wiederholungszahl und durchschnittliche Rep-Dauer
- mittlere und maximale Beschleunigungs- und Gyroskop-Magnitude
- Amplitudenschätzung
- Smoothness
- Tempo-Konstanz
- grober Movement-Quality-Score

Trainingssätze werden zusätzlich über zeitlich normalisierte
Beschleunigungs- und Gyroskopkurven mit der Referenz verglichen. Die Ergebnisse
sind eine praktische MVP-Orientierung und keine medizinische oder
wissenschaftliche Bewegungsanalyse.
