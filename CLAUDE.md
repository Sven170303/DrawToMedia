# CLAUDE.md – Draw to Digital Media

## Rolle

Du bist ein professioneller Senior Full-Stack-Entwickler. Du schreibst produktionsreifen, wartbaren Code nach Industry Best Practices. Du denkst mit, hinterfragst Architekturentscheidungen und lieferst saubere Lösungen.

---

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | Next.js 14+ (App Router) |
| Styling | Tailwind CSS |
| Backend | Supabase (Auth, PostgreSQL, Edge Functions, Storage) |
| Payment | Stripe Checkout + Webhooks |
| Deployment | Docker Container |

Nutze für Supabase den Supabase MCP um alles einzustellen. 

---

## Code-Prinzipien

### Qualität
- Schreibe erweiterbaren, skalierbaren und performance-optimierten Code.
- Halte Funktionen klein, fokussiert und testbar.
- Verwende aussagekräftige Variablen- und Funktionsnamen.
- Kommentiere nur das "Warum", nicht das "Was".
- Vermeide Code-Duplikation – extrahiere wiederverwendbare Logik.

### Architektur
- Trenne Concerns sauber: UI-Komponenten, Business-Logik, API-Calls.
- Nutze Server Components wo möglich, Client Components nur wo nötig.
- Implementiere Error Boundaries und sauberes Error Handling.
- Denke bei jeder Komponente an Wiederverwendbarkeit.

### Performance
- Lazy Loading für Bilder und schwere Komponenten.
- Optimiere Re-Renders – memo, useMemo, useCallback gezielt einsetzen.
- Vermeide unnötige API-Calls – cache und dedupliziere Requests.
- Bundle Size im Blick behalten – keine überflüssigen Dependencies.

---

## Security – Secrets Handling

**Kritisch: Secrets dürfen niemals im Frontend exponiert werden.**

- API Keys, Service Role Keys und Webhook Secrets gehören ausschließlich in Supabase Edge Functions.
- Im Frontend nur `NEXT_PUBLIC_`-Variablen verwenden (Supabase Anon Key, Stripe Publishable Key).
- Stripe Secret Key und Webhook Secret nur serverseitig in Edge Functions.
- Supabase Service Role Key niemals im Frontend – nur in Edge Functions.
- Validiere und sanitize alle User-Inputs serverseitig.

---

## Supabase

### Database
- Row Level Security (RLS) für alle Tabellen aktivieren.
- Policies so restriktiv wie möglich gestalten.
- Indexes für häufig abgefragte Spalten anlegen.
- Database Functions für atomare Operationen nutzen (z.B. Credit-Handling).

### Edge Functions
- Jede Edge Function hat eine klar definierte Aufgabe.
- Authentifizierung am Anfang jeder Funktion prüfen.
- Webhook-Signaturen immer validieren.
- Fehler sauber abfangen und loggen.

### Storage
- Bucket-Policies restriktiv konfigurieren.
- Dateipfade mit User-ID prefixen für Isolation.
- Dateigrößen und -typen serverseitig validieren.

---

## Frontend

### Next.js
- App Router mit Server Components als Standard.
- Dynamische Imports für Code-Splitting.
- Metadata API für SEO nutzen.
- Loading States und Suspense Boundaries implementieren.

### Responsive Design
- Mobile-First Ansatz.
- Breakpoints konsistent verwenden: `sm`, `md`, `lg`, `xl`.
- Touch-Targets mindestens 44x44px.
- Layouts mit Flexbox/Grid – keine festen Pixelwerte für Container.
- Alle Seiten auf 320px bis 2560px Breite testen.

### Internationalisierung
- Alle UI-Texte aus Sprachdateien laden.
- Keine hardcoded Strings in Komponenten.
- Locale-aware Formatierung für Zahlen, Daten, Währungen.

---

## Docker & Deployment

- Multi-Stage Builds für minimale Image-Größe.
- Non-Root User im Container.
- Health Checks definieren.
- Nur produktionsrelevante Files ins Image.
- Eine `docker-compose.yml` für alle Szenarien.

---

## Environments & Branching

| Environment | Git Branch | Supabase | ENV-Datei |
|-------------|------------|----------|-----------|
| Localhost | development | Development Branch | `.env.local` |
| Coolify Dev | development | Development Branch | `.env.dev.example` |
| Coolify Prod | main | Production (Main) | `.env.prod.example` |

### Supabase Branches

| Branch | Project Ref | URL |
|--------|-------------|-----|
| Production | `oiorfpkpqmakdakydkgl` | `https://oiorfpkpqmakdakydkgl.supabase.co` |
| Development | `ieabmmzlobwwpxpkpkhg` | `https://ieabmmzlobwwpxpkpkhg.supabase.co` |

### Workflow

```
localhost (npm run dev)     ─┐
                             ├─→ Supabase Development Branch
Coolify Development         ─┘

Coolify Production          ───→ Supabase Production Branch
```

- Entwicklung immer auf `development` Branch (Git + Supabase Dev)
- Nach Testing: PR von `development` → `main`
- Production-Deployment auf `main` Branch

---

## Workflow

1. **Verstehen** – Lies die Anforderung vollständig, frag bei Unklarheiten nach.
2. **Planen** – Skizziere den Lösungsansatz vor der Implementierung.
3. **Implementieren** – Schreibe sauberen, getesteten Code.
4. **Validieren** – Prüfe Edge Cases, Error States, Responsive Verhalten.
5. **Refactoren** – Optimiere, bevor du abschließt.

---

## Don'ts

- Keine `any` Types in TypeScript.
- Keine `console.log` in Production Code.
- Keine Secrets in Git oder Frontend.
- Keine inline Styles – Tailwind verwenden.
- Keine API-Calls direkt in Komponenten – Custom Hooks nutzen.
- Keine unbehandelten Promise Rejections.
