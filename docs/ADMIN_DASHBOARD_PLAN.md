# Admin Dashboard Implementation Plan

## Inhaltsverzeichnis
1. [Zusammenfassung](#zusammenfassung)
2. [Architektur-Überblick](#architektur-überblick)
3. [Sicherheitskonzept](#sicherheitskonzept)
4. [Datenbank-Schema](#datenbank-schema)
5. [Stripe-Produktstruktur](#stripe-produktstruktur)
6. [Frontend-Implementierung](#frontend-implementierung)
7. [Edge Functions](#edge-functions)
8. [Implementierungsschritte](#implementierungsschritte)

---

## Zusammenfassung

Dieses Dokument beschreibt die Implementierung eines Admin-Dashboards für Draw to Digital Media. Das Dashboard ermöglicht:

- **Separater Admin-Login** via OTP (E-Mail)
- **Dynamische Preiskonfiguration** (Tokens pro Euro, Kosten pro Bildgenerierung)
- **Sichere Stripe-Integration** (Preise serverseitig, nicht vom Frontend manipulierbar)

### Kernprinzipien
- Admin-Bereich vollständig isoliert vom User-Bereich
- Doppelte Authentifizierung: Supabase Auth + Admin-Rolle Validierung
- Preise werden NIEMALS vom Frontend an Stripe übermittelt
- Alle sensiblen Operationen in Supabase Edge Functions

---

## Architektur-Überblick

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   /admin/login          /admin/dashboard         User Dashboard     │
│   ┌─────────────┐       ┌─────────────┐          ┌─────────────┐   │
│   │ OTP Login   │──────▶│ Price Mgmt  │          │ Purchase    │   │
│   │ (E-Mail)    │       │ Token Conf  │          │ Flow        │   │
│   └─────────────┘       └──────┬──────┘          └──────┬──────┘   │
│                                │                        │           │
├────────────────────────────────┼────────────────────────┼───────────┤
│                                │                        │           │
│                         MIDDLEWARE                                  │
│              (Route Protection + Admin Check)                       │
│                                                                     │
└────────────────────────────────┼────────────────────────┼───────────┘
                                 │                        │
                                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   admin-update-pricing         create-payment-intent                │
│   ┌─────────────────┐          ┌─────────────────────┐             │
│   │ - Auth Check    │          │ - Product Selection │             │
│   │ - Admin Check   │          │ - Lookup Price in   │             │
│   │ - Update DB     │          │   pricing_config    │             │
│   │ - Sync Stripe   │          │ - Create Intent     │             │
│   └─────────────────┘          └─────────────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE DATABASE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   users (is_admin)    pricing_config    credit_packages             │
│   admin_sessions      admin_audit_log   stripe_products             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            STRIPE                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Products             Prices            PaymentIntents             │
│   (Credit Pakete)      (Dynamisch)       (Server-side)              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Sicherheitskonzept

### 1. Authentifizierung (Doppelte Absicherung)

```
┌──────────────────────────────────────────────────────────────┐
│                    Admin Login Flow                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User gibt E-Mail ein auf /admin/login                    │
│                     │                                        │
│                     ▼                                        │
│  2. Check: Ist E-Mail in admin_emails Whitelist?             │
│            (Vorab-Prüfung ohne Auth)                         │
│                     │                                        │
│            ┌───────┴───────┐                                 │
│            │               │                                 │
│         JA ▼            NEIN ▼                               │
│  3. Supabase sendet   Error: "Unauthorized"                  │
│     OTP via E-Mail                                           │
│                     │                                        │
│                     ▼                                        │
│  4. User gibt OTP Code ein                                   │
│                     │                                        │
│                     ▼                                        │
│  5. Supabase verifiziert OTP                                 │
│                     │                                        │
│                     ▼                                        │
│  6. Check: users.is_admin = true?                            │
│            (Zweite Prüfung nach Auth)                        │
│                     │                                        │
│            ┌───────┴───────┐                                 │
│            │               │                                 │
│         JA ▼            NEIN ▼                               │
│  7. Redirect zu        Error + Logout                        │
│     /admin/dashboard                                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2. Route Protection (Middleware)

```typescript
// Erweiterung der bestehenden middleware.ts
const adminPaths = ['/admin/dashboard', '/admin/settings'];

// Admin-Routen erfordern:
// 1. Gültige Supabase Session
// 2. is_admin = true in users Tabelle
// 3. Separate Admin-Session Cookie
```

### 3. Row Level Security (RLS)

```sql
-- pricing_config: Nur Admins können lesen/schreiben
CREATE POLICY "Admin read pricing_config"
ON pricing_config FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

-- credit_packages: Alle lesen, nur Admins schreiben
CREATE POLICY "Public read credit_packages"
ON credit_packages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin write credit_packages"
ON credit_packages FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);
```

### 4. Stripe-Sicherheit

```
┌──────────────────────────────────────────────────────────────┐
│            Sichere Payment Intent Erstellung                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  FRONTEND:                                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ User wählt Paket: "50 Credits" (package_id: xyz)    │    │
│  │                                                      │    │
│  │ GESENDET: { package_id: "xyz" }                     │    │
│  │ NICHT: { amount: 999, price: "10 EUR" }             │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  EDGE FUNCTION (create-payment-intent):                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. Auth validieren                                   │    │
│  │ 2. package_id in DB nachschlagen                     │    │
│  │ 3. Aktuellen Preis aus pricing_config holen          │    │
│  │ 4. PaymentIntent mit SERVERSEITIGEM Preis erstellen  │    │
│  │ 5. client_secret an Frontend zurückgeben             │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  FRONTEND:                                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Stripe.js mit client_secret Payment abschließen     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Datenbank-Schema

### Neue Tabellen

#### 1. `pricing_config` (Singleton-Tabelle)

```sql
CREATE TABLE pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tokens_per_euro INTEGER NOT NULL DEFAULT 10,
  tokens_per_generation INTEGER NOT NULL DEFAULT 5,
  min_purchase_amount NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  max_purchase_amount NUMERIC(10,2) NOT NULL DEFAULT 500.00,
  currency TEXT NOT NULL DEFAULT 'eur',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

-- Singleton constraint: Nur eine Zeile erlaubt
CREATE UNIQUE INDEX pricing_config_singleton ON pricing_config ((true));
```

#### 2. `credit_packages` (Vordefinierte Pakete)

```sql
CREATE TABLE credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_de TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,  -- Preis in Cents
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 3. `admin_emails` (Whitelist)

```sql
CREATE TABLE admin_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  added_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID REFERENCES users(id)
);
```

#### 4. `admin_audit_log` (Audit Trail)

```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Bestehende Tabellen-Änderungen

```sql
-- users.is_admin existiert bereits - keine Änderung nötig
```

---

## Stripe-Produktstruktur

### Produkte anlegen

Folgende Produkte werden in Stripe angelegt:

| Produkt | Stripe Product ID | Beschreibung |
|---------|-------------------|--------------|
| Credits Small (25) | `prod_TbP7gsMqq5F0j6` | 25 Credits Paket |
| Credits Medium (50) | `prod_TbP7RmZxu8oB86` | 50 Credits Paket |
| Credits Large (100) | `prod_TbP7wfEEAQDYnH` | 100 Credits Paket |
| Credits XL (250) | `prod_TbP7rOoTYcRhqK` | 250 Credits Paket |

### Preise (dynamisch via Admin)

Preise werden NICHT hardcoded in Stripe, sondern:
1. Admin legt Preis in `pricing_config` fest
2. Bei Kauf berechnet Edge Function den Preis
3. PaymentIntent wird mit berechnetem Preis erstellt

```
Beispiel:
- pricing_config.tokens_per_euro = 10
- User kauft 50 Credits
- Berechnung: 50 / 10 = 5 EUR = 500 Cents
- PaymentIntent.amount = 500
```

### Alternative: Feste Pakete mit dynamischen Stripe Prices

Für bessere Stripe-Integration (Invoices, Receipts):

```
Admin ändert Preis → Edge Function erstellt neuen Stripe Price
                   → Alten Price deaktivieren
                   → credit_packages.stripe_price_id aktualisieren
```

---

## Frontend-Implementierung

### Verzeichnisstruktur

```
src/app/
├── [locale]/
│   ├── admin/
│   │   ├── layout.tsx           # Admin-spezifisches Layout
│   │   ├── login/
│   │   │   └── page.tsx         # OTP Login für Admins
│   │   ├── dashboard/
│   │   │   └── page.tsx         # Hauptübersicht
│   │   └── settings/
│   │       ├── page.tsx         # Einstellungen
│   │       ├── pricing/
│   │       │   └── page.tsx     # Preiskonfiguration
│   │       └── packages/
│   │           └── page.tsx     # Credit-Pakete verwalten
│   └── (dashboard)/
│       └── credits/
│           └── page.tsx         # User-seitige Credit-Kaufseite
```

### Admin Login Page (`/admin/login`)

```tsx
// Komponenten:
// 1. E-Mail Input
// 2. "OTP senden" Button
// 3. OTP Input (6-stellig)
// 4. "Verifizieren" Button

// Flow:
// 1. E-Mail eingeben
// 2. Backend prüft admin_emails Whitelist
// 3. OTP wird gesendet
// 4. User gibt OTP ein
// 5. Redirect zu /admin/dashboard
```

### Admin Dashboard (`/admin/dashboard`)

```tsx
// Übersichts-Widgets:
// - Aktive User (letzte 30 Tage)
// - Generierungen (letzte 30 Tage)
// - Umsatz (letzte 30 Tage)
// - Credit-Verkäufe

// Quick Actions:
// - Preise anpassen
// - Pakete bearbeiten
// - Audit Log anzeigen
```

### Pricing Settings (`/admin/settings/pricing`)

```tsx
// Konfigurierbare Werte:
// - Tokens pro Euro (Slider: 1-100)
// - Tokens pro Generierung (Slider: 1-50)
// - Minimaler Kaufbetrag
// - Maximaler Kaufbetrag

// Live-Vorschau:
// "Bei aktueller Konfiguration:
//  - 10 EUR = 100 Credits
//  - 1 Generierung = 5 Credits
//  - User kann ~20 Bilder generieren"
```

### Package Management (`/admin/settings/packages`)

```tsx
// CRUD für credit_packages:
// - Neues Paket erstellen
// - Pakete aktivieren/deaktivieren
// - Reihenfolge ändern (Drag & Drop)
// - Preis anpassen (Stripe Price wird aktualisiert)
```

---

## Edge Functions

### 1. `admin-verify-email`

Prüft ob E-Mail in der Admin-Whitelist ist, bevor OTP gesendet wird.

```typescript
// supabase/functions/admin-verify-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { email } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Prüfe Whitelist
  const { data, error } = await supabase
    .from('admin_emails')
    .select('email')
    .eq('email', email.toLowerCase())
    .single()

  if (error || !data) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 403 }
    )
  }

  return new Response(
    JSON.stringify({ authorized: true }),
    { status: 200 }
  )
})
```

### 2. `admin-update-pricing`

Aktualisiert Preiskonfiguration mit Audit-Logging.

```typescript
// supabase/functions/admin-update-pricing/index.ts
serve(async (req) => {
  const supabase = createClient(/* ... */)

  // 1. Auth validieren
  const { data: { user } } = await supabase.auth.getUser(
    req.headers.get('Authorization')?.replace('Bearer ', '')
  )

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // 2. Admin-Rolle prüfen
  const { data: userData } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!userData?.is_admin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  // 3. Pricing aktualisieren
  const body = await req.json()
  const { tokens_per_euro, tokens_per_generation } = body

  await supabase
    .from('pricing_config')
    .update({
      tokens_per_euro,
      tokens_per_generation,
      updated_at: new Date().toISOString(),
      updated_by: user.id
    })
    .eq('id', body.id)

  // 4. Audit Log
  await supabase.from('admin_audit_log').insert({
    admin_id: user.id,
    action: 'UPDATE_PRICING',
    details: body,
    ip_address: req.headers.get('x-forwarded-for')
  })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
```

### 3. `create-payment-intent`

Erstellt PaymentIntent mit serverseitigem Preis.

```typescript
// supabase/functions/create-payment-intent/index.ts
import Stripe from 'https://esm.sh/stripe@13'

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
  const supabase = createClient(/* ... */)

  // 1. Auth validieren
  const { data: { user } } = await supabase.auth.getUser(
    req.headers.get('Authorization')?.replace('Bearer ', '')
  )

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { package_id } = await req.json()

  // 2. Paket aus DB holen (NICHT vom Frontend vertrauen!)
  const { data: pkg } = await supabase
    .from('credit_packages')
    .select('*')
    .eq('id', package_id)
    .eq('is_active', true)
    .single()

  if (!pkg) {
    return new Response(JSON.stringify({ error: 'Package not found' }), { status: 404 })
  }

  // 3. Preis berechnen oder aus DB holen
  const { data: pricing } = await supabase
    .from('pricing_config')
    .select('*')
    .single()

  // Preis ist in der DB in Cents gespeichert
  const amount = pkg.price_cents

  // 4. User's Stripe Customer ID holen oder erstellen
  const { data: userData } = await supabase
    .from('users')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single()

  let customerId = userData?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData?.email,
      metadata: { supabase_user_id: user.id }
    })
    customerId = customer.id

    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  // 5. PaymentIntent erstellen (PREIS VOM SERVER!)
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: pricing?.currency || 'eur',
    customer: customerId,
    metadata: {
      user_id: user.id,
      package_id: pkg.id,
      credits: pkg.credits
    },
    automatic_payment_methods: { enabled: true }
  })

  return new Response(JSON.stringify({
    client_secret: paymentIntent.client_secret,
    amount: amount,
    credits: pkg.credits
  }), { status: 200 })
})
```

### 4. `stripe-webhook`

Verarbeitet erfolgreiche Zahlungen.

```typescript
// supabase/functions/stripe-webhook/index.ts
serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
  const supabase = createClient(/* service role */)

  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const { user_id, package_id, credits } = paymentIntent.metadata

    // 1. Credits gutschreiben (atomare Operation)
    await supabase.rpc('add_credits', {
      p_user_id: user_id,
      p_credits: parseInt(credits)
    })

    // 2. Kauf dokumentieren
    await supabase.from('credit_purchases').insert({
      user_id,
      credits: parseInt(credits),
      amount_paid: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      stripe_payment_intent_id: paymentIntent.id
    })
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
```

---

## Implementierungsschritte

### Phase 1: Datenbank Setup (Supabase)

- [ ] **1.1** Tabelle `pricing_config` erstellen
- [ ] **1.2** Tabelle `credit_packages` erstellen
- [ ] **1.3** Tabelle `admin_emails` erstellen
- [ ] **1.4** Tabelle `admin_audit_log` erstellen
- [ ] **1.5** RLS Policies für alle Tabellen einrichten
- [ ] **1.6** Database Function `add_credits` erstellen (atomic)
- [ ] **1.7** Initial-Daten einfügen (pricing_config, admin_emails)

### Phase 2: Stripe Setup

- [ ] **2.1** Stripe Products für Credit-Pakete erstellen
- [ ] **2.2** Webhook Endpoint in Stripe Dashboard konfigurieren
- [ ] **2.3** credit_packages mit Stripe Product IDs verknüpfen

### Phase 3: Edge Functions

- [ ] **3.1** `admin-verify-email` implementieren
- [ ] **3.2** `admin-update-pricing` implementieren
- [ ] **3.3** `create-payment-intent` implementieren
- [ ] **3.4** `stripe-webhook` implementieren
- [ ] **3.5** Edge Functions deployen & testen

### Phase 4: Frontend - Admin Login

- [ ] **4.1** `/admin/login` Page erstellen
- [ ] **4.2** OTP Login Hook implementieren
- [ ] **4.3** Admin-Session Management
- [ ] **4.4** Middleware für `/admin/*` Routen erweitern

### Phase 5: Frontend - Admin Dashboard

- [ ] **5.1** Admin Layout erstellen
- [ ] **5.2** Dashboard Übersicht implementieren
- [ ] **5.3** Pricing Settings Page
- [ ] **5.4** Package Management Page
- [ ] **5.5** Audit Log Ansicht

### Phase 6: Frontend - User Credit Purchase

- [ ] **6.1** Credits Page mit Paket-Auswahl überarbeiten
- [ ] **6.2** Stripe Elements Integration
- [ ] **6.3** Payment Success/Cancel Handling
- [ ] **6.4** Credit Balance Update nach Kauf

### Phase 7: Testing & Security

- [ ] **7.1** Admin-Flow End-to-End testen
- [ ] **7.2** User-Kaufflow testen
- [ ] **7.3** RLS Policies verifizieren
- [ ] **7.4** Edge Function Security Review
- [ ] **7.5** Penetration Testing (manuell)

### Phase 8: Deployment

- [ ] **8.1** Environment Variables in Coolify setzen
- [ ] **8.2** Supabase Migrations auf Production anwenden
- [ ] **8.3** Edge Functions auf Production deployen
- [ ] **8.4** Stripe Live Mode aktivieren
- [ ] **8.5** Smoke Tests auf Production

---

## Anhang

### Environment Variables

```env
# .env.local (Entwicklung)
NEXT_PUBLIC_SUPABASE_URL=https://ieabmmzlobwwpxpkpkhg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Edge Functions Secrets (Supabase Dashboard)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Hilfreiche SQL Queries

```sql
-- Admin hinzufügen
INSERT INTO admin_emails (email) VALUES ('admin@example.com');
UPDATE users SET is_admin = true WHERE email = 'admin@example.com';

-- Pricing initialisieren
INSERT INTO pricing_config (tokens_per_euro, tokens_per_generation)
VALUES (10, 5);

-- Credit-Pakete initialisieren (mit echten Stripe Product IDs)
INSERT INTO credit_packages (name, name_de, name_en, name_fr, credits, price_cents, stripe_product_id, sort_order)
VALUES
  ('Small', 'Klein', 'Small', 'Petit', 25, 299, 'prod_TbP7gsMqq5F0j6', 1),
  ('Medium', 'Mittel', 'Medium', 'Moyen', 50, 499, 'prod_TbP7RmZxu8oB86', 2),
  ('Large', 'Groß', 'Large', 'Grand', 100, 899, 'prod_TbP7wfEEAQDYnH', 3),
  ('XL', 'XL', 'XL', 'XL', 250, 1999, 'prod_TbP7rOoTYcRhqK', 4);
```

### Referenzen

- [Supabase Auth OTP](https://supabase.com/docs/guides/auth/passwordless-login/auth-email-otp)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Stripe PaymentIntent](https://stripe.com/docs/payments/payment-intents)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
