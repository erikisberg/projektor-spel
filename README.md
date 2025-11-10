# Projektor Pong - 4-Player Multiplayer

Ett enkelt men robust multiplayer Pong-spel designat för projektor med mobila kontroller.

## Spelöversikt

- **4 spelare aktiva**: 2 vs 2 (Team Left vs Team Right)
- **Obegränsat antal i kö**: Automatisk rotation efter varje match
- **Projektor**: Visar spelplanen på stor skärm
- **Mobiler**: Varje spelare använder sin mobil som kontroller
- **Mål**: Första teamet till 10 poäng vinner

## Hur det fungerar

### Spelflöde

1. **Anslut**: Öppna controller.html på din mobil
2. **Kö**: Om spelet är fullt hamnar du i kö och ser din position (#1, #2, etc)
3. **Lobby**: När det är din tur kommer du till lobby med 3 andra spelare
4. **Ready Up**: Tryck på den stora "READY" knappen när du är redo
5. **Spela**: När alla 4 är ready startar spelet automatiskt
6. **Efter match**: Alla 4 spelare flyttas till slutet av kön, nästa 4 får spela

Detta säkerställer rättvis rotation där alla får spela lika mycket!

## Snabbstart

### 1. Starta servern

```bash
npm start
```

Servern startar på `http://localhost:3000`

### 2. Öppna projektorn

På datorn som är kopplad till projektorn, öppna:
```
http://localhost:3000/display.html
```

Tryck F11 för fullskärm.

### 3. Anslut mobiler

På varje spelares mobil, öppna:
```
http://[DIN-DATORS-IP]:3000/controller.html
```

För att hitta din dators IP:
- **Mac**: `ifconfig | grep inet` (leta efter 192.168.x.x)
- **Windows**: `ipconfig` (leta efter IPv4)
- **Linux**: `ip addr` (leta efter 192.168.x.x)

### 4. Spela!

#### På Projektorn ser du:
- **WAITING**: Väntar på spelare (< 4 anslutna)
- **LOBBY**: Visar vilka 4 spelare som ska spela + ready-status
- **PLAYING**: Själva spelet med paddles och boll
- **GAME OVER**: Vinnare + "Next players loading..."

#### På Mobilen:
- **Första 4 spelare**: Går direkt till lobby, tryck READY för att starta
- **Spelare 5+**: Hamnar i kö, ser sin position (#5, #6, etc)
- **I spel**: Touch/drag för att flytta din paddle
- **Efter match**: Tillbaka i kön, väntar på nästa tur

#### Teams:
- **Left Team** = Gröna paddles + UI (vänster sida)
- **Right Team** = Cyan paddles + UI (höger sida)

## Krav

- Node.js (v14 eller senare)
- WiFi-nätverk (alla enheter måste vara på samma nätverk)
- Moderna webbläsare (Chrome, Safari, Firefox)

## Utveckling

```bash
# Med auto-reload
npm run dev
```

## Tekniska detaljer

- **Backend**: Node.js + Express + Socket.io
- **Game Loop**: 60 ticks/sekund (server-side, pausar när inte PLAYING)
- **Rendering**: HTML5 Canvas (60 FPS)
- **Latens**: < 50ms på lokalt nätverk
- **Aktiva spelare**: 4 (2v2)
- **Kö-kapacitet**: Obegränsad
- **Game States**: WAITING → LOBBY → PLAYING → GAME_OVER (loop)
- **Ready System**: Alla 4 måste ready up innan start
- **Auto-rotation**: Efter match flyttas alla 4 till slutet av kön

## Felsökning

**Mobilen kan inte ansluta**:
- Kontrollera att alla enheter är på samma WiFi
- Dubbelkolla att du använder rätt IP-adress
- Stäng av firewall/antivirus temporärt

**Laggy gameplay**:
- Stäng andra appar på mobilen
- Kontrollera WiFi-styrka
- Använd 5GHz WiFi om möjligt

**Spelet fryser**:
- Uppdatera sidan (F5)
- Starta om servern

## Licens

MIT
