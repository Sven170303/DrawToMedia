# Stripe Integration Setup

Diese Dokumentation beschreibt die vollständige Stripe-Integration für Draw to Media.

## Übersicht

Die Stripe-Integration unterstützt:
- **Einmalkäufe** (Credits-Pakete)
- **Abonnements** (monatliche Credits)
- **Automatische Credit-Gutschrift** via Webhooks

## Stripe Produkte & Preise

### Einmalkäufe

| Paket | Product ID | Price ID | Preis | Credits |
|-------|-----------|----------|-------|---------|
| Starter | `prod_TX8ff9rU2hmuKA` | `price_1Sa4OGB6KiFq7suQs93Pgp8m` | 5,00€ | 5 |
| Standard | `prod_TX8fxksOk2BWvV` | `price_1Sa4OHB6KiFq7suQTgcrTdWS` | 12,00€ | 15 |
| Pro | `prod_TX8f5fPshnDHXd` | `price_1Sa4OHB6KiFq7suQgUMxpEnu` | 35,00€ | 50 |

### Abonnements (monatlich)

| Plan | Product ID | Price ID | Preis/Monat | Credits/Monat |
|------|-----------|----------|-------------|---------------|
| Basic | `prod_TX8f4XSQ5Ut4cS` | `price_1Sa4OIB6KiFq7suQ9zjdy3U2` | 10,00€ | 12 |
| Plus | `prod_TX8f6IOkSiMHzx` | `price_1Sa4OIB6KiFq7suQEVEkd6oe` | 20,00€ | 30 |

> **Preise anpassen:** Du kannst die Preise jederzeit im Stripe Dashboard ändern.
> Die neuen Preise werden automatisch in der App angezeigt, da sie dynamisch geladen werden.

## Supabase Edge Functions

### Erstellte Functions

1. **`create-checkout-session`**
   - Erstellt Stripe Checkout Sessions
   - Erfordert JWT-Authentifizierung
   - Endpoint: `POST /functions/v1/create-checkout-session`

2. **`stripe-webhook`**
   - Verarbeitet Stripe Webhook Events
   - **Wichtig:** JWT-Verifizierung muss deaktiviert werden!
   - Endpoint: `POST /functions/v1/stripe-webhook`

3. **`get-prices`**
   - Lädt aktuelle Preise von Stripe
   - Für dynamische Preisanzeige im Frontend
   - Endpoint: `GET /functions/v1/get-prices`

## Setup-Schritte

### 1. Supabase Secrets konfigurieren

Gehe zu: **Supabase Dashboard** → **Edge Functions** → **Secrets**

Füge folgende Secrets hinzu:

```
STRIPE_SECRET_KEY=sk_test_... (aus Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_... (wird in Schritt 3 erstellt)
FRONTEND_URL=https://draw-to-digital.com
```

### 2. JWT-Verifizierung für Webhook deaktivieren

Die `stripe-webhook` Function muss ohne JWT-Verifizierung aufgerufen werden können, da Stripe kein JWT sendet.

**Option A: Via Supabase Dashboard**
1. Gehe zu Edge Functions
2. Klicke auf `stripe-webhook`
3. Deaktiviere "Verify JWT"

**Option B: Via CLI**
```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

### 3. Stripe Webhook konfigurieren

1. Gehe zu: **Stripe Dashboard** → **Developers** → **Webhooks**
2. Klicke "Add endpoint"
3. Endpoint URL: `https://oiorfpkpqmakdakydkgl.supabase.co/functions/v1/stripe-webhook`
4. Events auswählen:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Klicke "Add endpoint"
6. Kopiere das "Signing secret" (whsec_...)
7. Füge es als `STRIPE_WEBHOOK_SECRET` in Supabase Secrets ein

### 4. Frontend ENV-Variablen

Erstelle `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://oiorfpkpqmakdakydkgl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Payment Flow

```
1. User klickt "Kaufen" auf Pricing-Seite
   ↓
2. Frontend ruft create-checkout-session auf
   ↓
3. User wird zu Stripe Checkout weitergeleitet
   ↓
4. User bezahlt
   ↓
5. Stripe sendet Webhook an stripe-webhook
   ↓
6. Edge Function:
   - Verifiziert Webhook-Signatur
   - Schreibt Credits gut (add_credits RPC)
   - Erstellt/aktualisiert Subscription-Eintrag
   ↓
7. User wird zu /payment/success weitergeleitet
```

## Abo-Verlängerung

Bei monatlicher Abo-Verlängerung:
1. Stripe sendet `invoice.payment_succeeded` mit `billing_reason: "subscription_cycle"`
2. Edge Function addiert die monatlichen Credits zum bestehenden Guthaben
3. Credits verfallen **nicht** - sie sammeln sich an

## Testen

### Testkarten

- Erfolgreiche Zahlung: `4242 4242 4242 4242`
- Ablehnung: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

### Webhook lokal testen

```bash
# Stripe CLI installieren
brew install stripe/stripe-cli/stripe

# Einloggen
stripe login

# Webhooks forwarden
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

## Preise ändern

Du kannst Preise jederzeit im Stripe Dashboard ändern:

1. Gehe zu **Products** im Stripe Dashboard
2. Wähle das Produkt aus
3. Füge einen neuen Preis hinzu oder archiviere den alten
4. Der neue Preis wird automatisch in der App angezeigt

**Hinweis:** Bei Preisänderungen musst du ggf. die Price IDs in der `stripe-webhook` Edge Function aktualisieren, damit die richtigen Credits gutgeschrieben werden.

## Troubleshooting

### Webhook-Fehler 401

Die JWT-Verifizierung ist noch aktiv. Deaktiviere sie wie in Schritt 2 beschrieben.

### Credits werden nicht gutgeschrieben

1. Prüfe die Edge Function Logs in Supabase
2. Stelle sicher, dass die Price IDs korrekt gemappt sind
3. Prüfe ob die `add_credits` RPC-Funktion existiert

### Preise werden nicht geladen

1. Prüfe ob `STRIPE_SECRET_KEY` in Supabase Secrets gesetzt ist
2. Prüfe die `get-prices` Logs auf Fehler
