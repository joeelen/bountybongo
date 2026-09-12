# Guide: Start og Stopp av Bountyrunner

Lagre dette notatet for å raskt starte og stoppe spillet lokalt og på nett.

---

## 🚀 Slik starter du spillet (Start)

Kjør disse trinnene i rekkefølge:

### 1. Start databasen (Docker)
Åpne en terminal og kjør:
```bash
docker start bounty-db
```
*Hvis du får feilmeldingen `No such container: bounty-db`, betyr det at containeren ikke er opprettet på denne PC-en ennå. Opprett og start den ved å kjøre denne kommandoen (kun første gang):*
```bash
docker run --name bounty-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bountyrunner -p 5432:5432 -d postgres
```


### 2. Start spillserveren (Vite & Express)
Åpne en ny terminal, gå til prosjektmappen og kjør:
```bash
cd "c:\Users\joels\GEMINI PROJECTS (mine egne)\Bountyrunner"
npm run dev
```
*Sjekk at det står: `✅ PostgreSQL Connection: SUCCESS`.*

### 3. Gjør spillet tilgjengelig på nett (ngrok)
Åpne en ny, egen terminal og kjør:
```bash
ngrok http 3000
```
*Kopier den sikre lenken som slutter på `.ngrok-free.dev` og send den til telefonen din/venner for å spille med ekte GPS.*

---

## 🛑 Slik stopper du spillet (Stopp)

Når du er ferdig med å spille, lukker du tilkoblingene slik:

### 1. Stopp ngrok-tunnelen
*   Gå til terminalen som kjører `ngrok`.
*   Trykk **`Ctrl + C`** for å avslutte.

### 2. Stopp spillserveren
*   Gå til terminalen som kjører `npm run dev`.
*   Trykk **`Ctrl + C`** (og bekreft med `J` / `Y` hvis den spør) for å avslutte.

### 3. Stopp databasen (Docker)
*   Åpne en terminal og kjør:
```bash
docker stop bounty-db
```
