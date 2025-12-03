# Product Requirements Document: Draw to Digital Media

## 1. Product Overview

Das Produkt "Draw to Digital Media" ist eine Web-Anwendung, die Nutzern ermöglicht, handgezeichnete Skizzen per Foto hochzuladen und diese mit Hilfe von Nano Banana in vollständige, randfreie digitale Medien umzuwandeln. Es kombiniert einen gemalten, skizzenhaften Stil mit modernen Animationen für eine fancy, schnelle Nutzererfahrung. Der Fokus liegt auf Einfachheit: Nutzer kaufen Credits via Stripe, aktivieren sich per OTP und generieren Bilder mit optionalen Freitext-Eingaben für Anpassungen, wie z.B. Ergänzungen zu einer Menükarte.

Die Anwendung wird von Anfang an in Deutsch, Englisch und Französisch verfügbar sein. Die gesamte UI – inklusive Landingpage, Authentifizierung und Nutzerführung – ist vollständig lokalisiert; für alle Inhalte und Anweisungen werden Sprachressourcen in separaten JSON-Dateien organisiert und mit einem Language Selector angebunden. Für die Umsetzung wird auf Next.js-i18n-Routing zurückgegriffen. Für Supabase-spezifische Inhalte (Fehlermeldungen, Mails) können lokalisierte Vorlagen integriert werden, sodass E-Mails zur Kontoaktivierung und Fehlermeldungen in der jeweils gewählten Sprache ankommen.

### 1.1 Mehrsprachigkeit

- Mehrsprachige Unterstützung ist ein fester Bestandteil der UI/UX-Spezifikation.
- Sprachwechsel ist jederzeit auf allen Seiten und nach Login möglich.
- Translations werden für statische wie dynamische Inhalte als JSON/Bibliothek gepflegt.
- Deployments berücksichtigen Ländercode in URL-Struktur (z.B. /de/, /fr/, /en/).

Dieses Feature bringt zusätzlichen Testing- und Wartungsaufwand mit sich, sollte aber die Reichweite und Nutzungsrate der App deutlich erhöhen.

---

## 2. Target Users and Assumptions

Zielgruppe sind kreative Endnutzer, die Skizzen digitalisieren möchten, wie Künstler, Designer oder Hobbyzeichner. Es wird angenommen, dass Nutzer Fotos von physischen Zeichnungen hochladen und grundlegende Prompts eingeben, ohne fortgeschrittene KI-Kenntnisse. Keine Admin-Rollen sind initial geplant, aber die Datenbank (Supabase) enthält ein Feld für zukünftige Admin-Features wie Moderation.

---

## 3. System Architecture

### 3.1 Architektur-Übersicht

Die Anwendung folgt einer serverlosen Architektur ohne dediziertes Backend:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│                         Next.js Application                              │
│                    (Kulify Docker Deployment)                            │
└─────────────────┬───────────────────────────────────────┬───────────────┘
                  │                                       │
                  │ Supabase Client SDK                   │ Stripe.js
                  │ (Auth, DB, Storage)                   │ (Checkout Redirect)
                  ▼                                       ▼
┌─────────────────────────────────────┐   ┌───────────────────────────────┐
│           SUPABASE                   │   │          STRIPE               │
│  ┌─────────────────────────────┐    │   │                               │
│  │     PostgreSQL Database     │    │   │   ┌───────────────────────┐   │
│  │  - users                    │    │   │   │   Checkout Session    │   │
│  │  - credits                  │    │   │   │   (Hosted Page)       │   │
│  │  - generations              │    │   │   └───────────────────────┘   │
│  │  - feedback                 │    │   │              │                │
│  │  - subscriptions            │    │   │              │ Webhook        │
│  └─────────────────────────────┘    │   │              ▼                │
│  ┌─────────────────────────────┐    │   └──────────────┬────────────────┘
│  │     Supabase Auth           │    │                  │
│  │  - Email/OTP                │    │                  │
│  └─────────────────────────────┘    │                  │
│  ┌─────────────────────────────┐    │                  │
│  │     Supabase Storage        │    │                  │
│  │  - Uploaded Images          │    │                  │
│  │  - Generated Images         │    │                  │
│  └─────────────────────────────┘    │                  │
│  ┌─────────────────────────────┐    │                  │
│  │     Edge Functions          │◄───┼──────────────────┘
│  │  - stripe-webhook           │    │
│  │  - create-checkout-session  │    │
│  │  - generate-image           │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 3.2 Komponenten

| Komponente | Technologie | Verantwortlichkeit |
|------------|-------------|-------------------|
| Frontend | Next.js 14+ (App Router) | UI, Routing, i18n, Client-Side Logic |
| Authentifizierung | Supabase Auth | Email/OTP-Login, Session Management |
| Datenbank | Supabase PostgreSQL | User-Daten, Credits, Generierungen, Feedback |
| Datei-Storage | Supabase Storage | Upload- und generierte Bilder |
| Payment | Stripe Checkout + Webhooks | Zahlungsabwicklung |
| Serverless Backend | Supabase Edge Functions (Deno) | Webhook-Handling, sichere API-Calls |
| Bildgenerierung | Nano Banana API | KI-Bildgenerierung |
| Analytics | Google Analytics 4 | Nutzerverhalten-Tracking |

---

## 4. Functional Requirements

### 4.1 User Registration and Authentication

#### 4.1.1 Registrierung
- Nutzer geben ihre E-Mail-Adresse ein.
- Supabase Auth sendet einen OTP-Code (6-stellig) an die E-Mail.
- Der OTP-Code ist 10 Minuten gültig.
- Nach erfolgreicher OTP-Verifizierung wird der Account aktiviert.
- Ein Eintrag in der `users`-Tabelle wird erstellt mit `credits = 0`.

#### 4.1.2 Login
- Bestehende Nutzer geben ihre E-Mail ein.
- Supabase Auth sendet einen neuen OTP-Code.
- Nach Verifizierung wird eine Session erstellt.
- Sessions sind 7 Tage gültig mit automatischer Refresh-Funktion.

#### 4.1.3 Profil-Management
- Nutzer können ihre E-Mail-Adresse ändern (erfordert OTP-Bestätigung der neuen E-Mail).
- Anzeige des aktuellen Credit-Guthabens.
- Anzeige des Subscription-Status (aktiv/inaktiv, nächstes Verlängerungsdatum).
- Sprachwahl persistent im User-Profil gespeichert.

### 4.2 Payment and Credits System

#### 4.2.1 Credit-Modelle

**Pay-as-you-go (Einmalkauf):**
| Paket | Credits | Preis | Preis pro Credit |
|-------|---------|-------|------------------|
| Starter | 5 Credits | 5,00 € | 1,00 € |
| Standard | 15 Credits | 12,00 € | 0,80 € |
| Pro | 50 Credits | 35,00 € | 0,70 € |

**Subscription (monatlich):**
| Plan | Credits/Monat | Preis/Monat | Preis pro Credit |
|------|---------------|-------------|------------------|
| Basic | 12 Credits | 10,00 € | 0,83 € |
| Plus | 30 Credits | 20,00 € | 0,67 € |

#### 4.2.2 Payment Flow (Stripe Checkout + Supabase Edge Functions)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PAYMENT FLOW                                      │
└──────────────────────────────────────────────────────────────────────────┘

1. USER INITIIERT KAUF
   ┌─────────────┐
   │   Frontend  │ ──► User klickt "Credits kaufen" oder "Abo abschließen"
   └──────┬──────┘
          │
          ▼
2. CHECKOUT SESSION ERSTELLEN
   ┌─────────────────────────────────────┐
   │  Edge Function:                      │
   │  create-checkout-session             │
   │  ─────────────────────────────────── │
   │  POST /functions/v1/create-checkout  │
   │                                      │
   │  Request Body:                       │
   │  {                                   │
   │    "priceId": "price_xxx",           │
   │    "userId": "uuid",                 │
   │    "mode": "payment" | "subscription"│
   │    "locale": "de" | "en" | "fr"      │
   │  }                                   │
   │                                      │
   │  Funktion:                           │
   │  - Validiert User-ID gegen Supabase  │
   │  - Erstellt Stripe Checkout Session  │
   │  - Setzt success_url und cancel_url  │
   │  - Speichert userId in metadata      │
   │                                      │
   │  Response:                           │
   │  { "checkoutUrl": "https://..." }    │
   └──────────────────┬──────────────────┘
                      │
                      ▼
3. REDIRECT ZU STRIPE CHECKOUT
   ┌─────────────┐
   │   Frontend  │ ──► window.location.href = checkoutUrl
   └──────┬──────┘
          │
          ▼
4. STRIPE HOSTED CHECKOUT PAGE
   ┌─────────────────────────────────────┐
   │  Stripe Checkout (gehostet)          │
   │  ─────────────────────────────────── │
   │  - Zahlungsmethode eingeben          │
   │  - Kreditkarte / SEPA / etc.         │
   │  - Stripe übernimmt PCI Compliance   │
   │  - Lokalisiert nach "locale" Param   │
   └──────────────────┬──────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   ┌──────────────┐       ┌──────────────┐
   │   ERFOLG     │       │   ABBRUCH    │
   │  success_url │       │  cancel_url  │
   └──────┬───────┘       └──────┬───────┘
          │                      │
          │                      ▼
          │               ┌──────────────┐
          │               │   Frontend   │
          │               │ /payment/    │
          │               │ cancelled    │
          │               └──────────────┘
          │
          ▼
5. STRIPE WEBHOOK (asynchron, parallel zu Redirect)
   ┌─────────────────────────────────────┐
   │  Stripe Server                       │
   │  ─────────────────────────────────── │
   │  Sendet Webhook Event an:            │
   │  POST /functions/v1/stripe-webhook   │
   │                                      │
   │  Events:                             │
   │  - checkout.session.completed        │
   │  - invoice.payment_succeeded         │
   │  - customer.subscription.updated     │
   │  - customer.subscription.deleted     │
   └──────────────────┬──────────────────┘
                      │
                      ▼
6. EDGE FUNCTION: STRIPE-WEBHOOK
   ┌─────────────────────────────────────┐
   │  Edge Function:                      │
   │  stripe-webhook                      │
   │  ─────────────────────────────────── │
   │                                      │
   │  1. Webhook Signature verifizieren   │
   │     - STRIPE_WEBHOOK_SECRET aus Env  │
   │     - stripe.webhooks.constructEvent │
   │     - Bei Fehler: 400 Response       │
   │                                      │
   │  2. Event-Typ verarbeiten:           │
   │                                      │
   │  checkout.session.completed:         │
   │  ├─ mode === "payment":              │
   │  │  └─ Credits gutschreiben          │
   │  │     UPDATE users                  │
   │  │     SET credits = credits + X     │
   │  │     WHERE id = metadata.userId    │
   │  │                                   │
   │  │     INSERT INTO credit_purchases  │
   │  │     (user_id, amount, stripe_id)  │
   │  │                                   │
   │  └─ mode === "subscription":         │
   │     └─ Subscription aktivieren       │
   │        INSERT INTO subscriptions     │
   │        (user_id, stripe_sub_id,      │
   │         plan, status, period_end)    │
   │                                      │
   │        Credits gutschreiben          │
   │        UPDATE users                  │
   │        SET credits = credits + X     │
   │                                      │
   │  invoice.payment_succeeded:          │
   │  └─ Subscription-Verlängerung        │
   │     UPDATE subscriptions             │
   │     SET period_end = new_date        │
   │                                      │
   │     Credits gutschreiben             │
   │     (monatliche Credits)             │
   │                                      │
   │  customer.subscription.deleted:      │
   │  └─ Subscription deaktivieren        │
   │     UPDATE subscriptions             │
   │     SET status = 'cancelled'         │
   │                                      │
   │  3. Response: 200 OK                 │
   └─────────────────────────────────────┘
                      │
                      ▼
7. USER KEHRT ZURÜCK
   ┌─────────────────────────────────────┐
   │  Frontend: /payment/success          │
   │  ─────────────────────────────────── │
   │  - Zeigt Erfolgsmeldung              │
   │  - Pollt Credit-Stand (max 10s)      │
   │  - Leitet zum Dashboard weiter       │
   └─────────────────────────────────────┘
```

#### 4.2.3 Edge Function: create-checkout-session

**Endpoint:** `POST /functions/v1/create-checkout-session`

**Request Headers:**
```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "priceId": "price_1ABC123",
  "mode": "payment",
  "locale": "de"
}
```

**Implementierung:**
```typescript
// supabase/functions/create-checkout-session/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@13?target=deno"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
})

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

serve(async (req) => {
  // CORS Headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    })
  }

  try {
    // User aus JWT Token extrahieren
    const authHeader = req.headers.get("Authorization")!
    const token = authHeader.replace("Bearer ", "")
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401 
      })
    }

    const { priceId, mode, locale } = await req.json()

    // Stripe Customer erstellen oder abrufen
    let stripeCustomerId: string
    
    const { data: userData } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single()

    if (userData?.stripe_customer_id) {
      stripeCustomerId = userData.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      stripeCustomerId = customer.id
      
      await supabase
        .from("users")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", user.id)
    }

    // Checkout Session erstellen
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: mode, // "payment" oder "subscription"
      payment_method_types: ["card", "sepa_debit"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${Deno.env.get("FRONTEND_URL")}/${locale}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get("FRONTEND_URL")}/${locale}/payment/cancelled`,
      locale: locale as Stripe.Checkout.SessionCreateParams.Locale,
      metadata: {
        supabase_user_id: user.id,
      },
    })

    return new Response(
      JSON.stringify({ checkoutUrl: session.url }),
      { 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        } 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

#### 4.2.4 Edge Function: stripe-webhook

**Endpoint:** `POST /functions/v1/stripe-webhook`

**Implementierung:**
```typescript
// supabase/functions/stripe-webhook/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@13?target=deno"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
})

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!
const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// Credit-Mapping für Price IDs
const PRICE_TO_CREDITS: Record<string, number> = {
  "price_starter_5": 5,
  "price_standard_15": 15,
  "price_pro_50": 50,
  "price_basic_sub": 12,
  "price_plus_sub": 30,
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature")!
  const body = await req.text()

  let event: Stripe.Event

  // 1. Webhook Signature verifizieren
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message)
    return new Response(JSON.stringify({ error: "Invalid signature" }), { 
      status: 400 
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 2. Event verarbeiten
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id
        
        if (!userId) {
          throw new Error("No user ID in session metadata")
        }

        if (session.mode === "payment") {
          // Einmalkauf: Credits gutschreiben
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
          const priceId = lineItems.data[0]?.price?.id
          const credits = PRICE_TO_CREDITS[priceId!] || 0

          // Credits erhöhen
          await supabase.rpc("add_credits", { 
            user_id: userId, 
            amount: credits 
          })

          // Kauf protokollieren
          await supabase.from("credit_purchases").insert({
            user_id: userId,
            credits: credits,
            amount_paid: session.amount_total! / 100,
            currency: session.currency,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent as string,
          })

        } else if (session.mode === "subscription") {
          // Subscription: Abo aktivieren und erste Credits gutschreiben
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )
          const priceId = subscription.items.data[0].price.id
          const credits = PRICE_TO_CREDITS[priceId] || 0

          // Subscription speichern
          await supabase.from("subscriptions").insert({
            user_id: userId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            price_id: priceId,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })

          // Erste Credits gutschreiben
          await supabase.rpc("add_credits", { 
            user_id: userId, 
            amount: credits 
          })
        }
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        
        // Nur für Subscription-Verlängerungen (nicht erste Zahlung)
        if (invoice.billing_reason === "subscription_cycle") {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          )
          
          // User ID aus Subscription Metadata holen
          const { data: subData } = await supabase
            .from("subscriptions")
            .select("user_id, price_id")
            .eq("stripe_subscription_id", subscription.id)
            .single()

          if (subData) {
            const credits = PRICE_TO_CREDITS[subData.price_id] || 0

            // Monatliche Credits gutschreiben
            await supabase.rpc("add_credits", { 
              user_id: subData.user_id, 
              amount: credits 
            })

            // Subscription-Periode aktualisieren
            await supabase
              .from("subscriptions")
              .update({
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                status: subscription.status,
              })
              .eq("stripe_subscription_id", subscription.id)
          }
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        
        await supabase
          .from("subscriptions")
          .update({
            status: subscription.status,
            price_id: subscription.items.data[0].price.id,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        
        await supabase
          .from("subscriptions")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id)
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
    
  } catch (error) {
    console.error("Webhook processing error:", error)
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }), 
      { status: 500 }
    )
  }
})
```

#### 4.2.5 Stripe Konfiguration

**Erforderliche Stripe Products und Prices:**

| Product Name | Price ID (Beispiel) | Typ | Preis |
|--------------|---------------------|-----|-------|
| Starter Pack (5 Credits) | price_starter_5 | one_time | 5,00 € |
| Standard Pack (15 Credits) | price_standard_15 | one_time | 12,00 € |
| Pro Pack (50 Credits) | price_pro_50 | one_time | 35,00 € |
| Basic Subscription | price_basic_sub | recurring (monthly) | 10,00 €/Monat |
| Plus Subscription | price_plus_sub | recurring (monthly) | 20,00 €/Monat |

**Stripe Webhook Events zu konfigurieren:**
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Webhook Endpoint:**
```
https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

### 4.3 Image Upload and Generation

#### 4.3.1 Upload-Prozess
- Nutzer laden Fotos ihrer Zeichnungen über Drag-and-Drop oder Datei-Auswahl hoch.
- Unterstützte Formate: JPEG, PNG, WEBP.
- Maximale Dateigröße: 10 MB.
- Bilder werden in Supabase Storage im Bucket `uploads` gespeichert.
- Pfadstruktur: `uploads/{user_id}/{timestamp}_{original_filename}`

#### 4.3.2 Generierungs-Prozess

**Edge Function: generate-image**

```typescript
// supabase/functions/generate-image/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SYSTEM_PROMPT = `Du bist ein Bildgenerator, der handgezeichnete Skizzen in vollständige, 
randfreie digitale Medien umwandelt. Das Ergebnis muss:
- Keine weißen Ränder oder Beschnitte haben
- Das gesamte Bild ausfüllen
- Den Stil der Originalskizze respektieren aber digital optimieren
- Professionell und druckfertig sein`

serve(async (req) => {
  // Auth und Credit-Check
  const authHeader = req.headers.get("Authorization")!
  const token = authHeader.replace("Bearer ", "")
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )
  
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  // Credits prüfen
  const { data: userData } = await supabase
    .from("users")
    .select("credits")
    .eq("id", user.id)
    .single()

  if (!userData || userData.credits < 1) {
    return new Response(
      JSON.stringify({ error: "Insufficient credits" }), 
      { status: 402 }
    )
  }

  const { uploadedImageUrl, userPrompt, format, resolution } = await req.json()

  const startTime = Date.now()

  // Nano Banana API aufrufen
  const nanoBananaResponse = await fetch(Deno.env.get("NANO_BANANA_API_URL")!, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("NANO_BANANA_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_prompt: SYSTEM_PROMPT,
      user_prompt: userPrompt || "",
      input_image: uploadedImageUrl,
      output_format: format,
      resolution: resolution,
    }),
  })

  if (!nanoBananaResponse.ok) {
    return new Response(
      JSON.stringify({ error: "Generation failed" }), 
      { status: 500 }
    )
  }

  const generatedImageData = await nanoBananaResponse.json()
  const generationTime = Math.round((Date.now() - startTime) / 1000)

  // Generiertes Bild in Storage speichern
  const fileName = `generated/${user.id}/${Date.now()}.${format}`
  const { data: storageData } = await supabase.storage
    .from("generations")
    .upload(fileName, generatedImageData.image, {
      contentType: `image/${format}`,
    })

  const { data: publicUrl } = supabase.storage
    .from("generations")
    .getPublicUrl(fileName)

  // Credit abziehen
  await supabase.rpc("deduct_credit", { user_id: user.id })

  // Generation in DB speichern
  await supabase.from("generations").insert({
    user_id: user.id,
    original_image_url: uploadedImageUrl,
    generated_image_url: publicUrl.publicUrl,
    user_prompt: userPrompt,
    system_prompt: SYSTEM_PROMPT,
    format: format,
    resolution: resolution,
    generation_time_seconds: generationTime,
  })

  return new Response(
    JSON.stringify({
      imageUrl: publicUrl.publicUrl,
      generationTime: generationTime,
    }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

#### 4.3.3 Generierungs-Optionen

| Option | Werte | Standard |
|--------|-------|----------|
| Format | JPEG, PNG | PNG |
| Auflösung | 512x512, 1024x1024, 2048x2048 | 1024x1024 |
| User Prompt | Freitext (max. 500 Zeichen) | leer |

### 4.4 Feedback System

- Nach jeder Generierung wird ein Feedback-Button angezeigt.
- Nutzer können detaillierte Kommentare in einem Textfeld eingeben (max. 2000 Zeichen).
- Jedes Feedback kostet 1 Credit.
- Feedback kann zu eigenen oder fremden (öffentlichen) Bildern gegeben werden.
- Mehrere Feedbacks pro Bild sind möglich.

### 4.5 History and Storage

#### 4.5.1 User-Historie
- Alle generierten Bilder werden in der persönlichen Historie gespeichert.
- Anzeige: Thumbnail, Datum, Generierungszeit, User-Prompt.
- System-Prompts werden gespeichert, aber nicht angezeigt (für interne Analysen).
- Sortierung: Neueste zuerst.
- Pagination: 20 Bilder pro Seite.

#### 4.5.2 Datenaufbewahrung
- Bilder und Daten werden unbegrenzt gespeichert.
- Nutzer können einzelne Generierungen löschen.
- Bei Account-Löschung werden alle Daten nach 30 Tagen endgültig entfernt.

---

## 5. Database Schema (Supabase PostgreSQL)

```sql
-- Users Tabelle (erweitert Supabase Auth)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  credits INTEGER DEFAULT 0 NOT NULL,
  stripe_customer_id TEXT,
  preferred_language TEXT DEFAULT 'de' CHECK (preferred_language IN ('de', 'en', 'fr')),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  price_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'active', 'cancelled', 'past_due', etc.
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Purchases (Einmalkäufe)
CREATE TABLE public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'eur',
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generations
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  original_image_url TEXT NOT NULL,
  generated_image_url TEXT NOT NULL,
  user_prompt TEXT,
  system_prompt TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('jpeg', 'png')),
  resolution TEXT NOT NULL,
  generation_time_seconds INTEGER NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Database Functions
CREATE OR REPLACE FUNCTION add_credits(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users 
  SET credits = credits + amount, updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION deduct_credit(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users 
  SET credits = credits - 1, updated_at = NOW()
  WHERE id = user_id AND credits > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own purchases" ON public.credit_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own generations" ON public.generations
  FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Users can insert own generations" ON public.generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own generations" ON public.generations
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view all feedback" ON public.feedback
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can insert own feedback" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_created_at ON public.generations(created_at DESC);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
```

---

## 6. Environment Variables

### 6.1 Frontend (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Stripe (Public Key für Frontend)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# App
NEXT_PUBLIC_APP_URL=https://draw-to-digital.com

# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 6.2 Supabase Edge Functions (Secrets)

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Supabase (automatisch verfügbar)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Nano Banana
NANO_BANANA_API_URL=https://api.nanobanana.com/v1/generate
NANO_BANANA_API_KEY=nb_xxx

# Frontend URL für Redirects
FRONTEND_URL=https://draw-to-digital.com
```

---

## 7. Non-Functional Requirements

### 7.1 UI/UX Design

- Gemalter Stil mit kariertem, creme-weißem Hintergrund (#FFFDF5).
- Blockige, lesbare Typografie (z.B. "Fredoka One" für Headlines, "Nunito" für Body).
- Responsive Web-App für Desktop (min. 1024px) und Mobile (min. 320px).
- Animationen:
  - Fortschrittsbalken bei Generierung mit Sketch-Stil.
  - Anzeige der Generierungsdauer in Sekunden (Echtzeit-Counter).
  - Sanfte Übergänge zwischen Seiten (300ms ease-in-out).
- Keine spezifischen Accessibility-Anforderungen initial.

### 7.2 Performance

- Initiales Laden der Seite: < 3 Sekunden.
- Time to Interactive: < 5 Sekunden.
- Bildgenerierung: Timeout nach 120 Sekunden.

### 7.3 Security

- Alle API-Aufrufe über HTTPS.
- Supabase Row Level Security für alle Tabellen aktiv.
- Stripe Webhook-Signatur-Validierung verpflichtend.
- Keine sensiblen Daten im Frontend speichern.
- Service Role Key nur in Edge Functions verwenden.

---

## 8. Technical Stack Summary

| Schicht | Technologie | Zweck |
|---------|-------------|-------|
| Frontend | Next.js 14+ (App Router) | UI, Routing, SSR/SSG |
| Styling | Tailwind CSS | Responsive Design |
| i18n | next-intl | Mehrsprachigkeit |
| Auth | Supabase Auth | OTP-Login |
| Database | Supabase PostgreSQL | Datenspeicherung |
| Storage | Supabase Storage | Bilder |
| Serverless | Supabase Edge Functions (Deno) | API-Logik, Webhooks |
| Payment | Stripe Checkout + Webhooks | Zahlungen |
| AI | Nano Banana API | Bildgenerierung |
| Analytics | Google Analytics 4 | Tracking |
| Deployment | Kulify (Docker) | Hosting |

---

## 9. Legal Requirements

### 9.1 Footer-Links (auf allen Seiten)

- AGB (Allgemeine Geschäftsbedingungen)
- Datenschutzerklärung
- Impressum
- Kontakt

### 9.2 Support

- E-Mail-Support: support@draw-to-digital.com
- Kontaktformular auf dedizierter Support-Seite.
- Antwortzeit: 48 Stunden (keine SLA-Garantie).

### 9.3 Hinweise

- Legal-Texte werden manuell erstellt (kein automatisches Generieren).
- DSGVO-konforme Datenschutzerklärung erforderlich.
- Cookie-Banner mit Opt-in für Analytics.

---

## 10. Deployment Checklist

### 10.1 Stripe Setup
- [ ] Stripe Account erstellen und verifizieren
- [ ] Products und Prices in Stripe Dashboard anlegen
- [ ] Webhook Endpoint konfigurieren
- [ ] Webhook Secret kopieren
- [ ] Live-Keys generieren

### 10.2 Supabase Setup
- [ ] Projekt erstellen
- [ ] Database Schema ausführen
- [ ] Storage Buckets erstellen (`uploads`, `generations`)
- [ ] Edge Functions deployen
- [ ] Secrets setzen (Stripe Keys, Nano Banana Key)
- [ ] RLS Policies aktivieren

### 10.3 Frontend Deployment
- [ ] Environment Variables setzen
- [ ] Docker Image bauen
- [ ] Auf Kulify deployen
- [ ] Domain konfigurieren
- [ ] SSL verifizieren

### 10.4 Testing
- [ ] OTP-Flow testen
- [ ] Stripe Test-Modus: Einmalkauf testen
- [ ] Stripe Test-Modus: Subscription testen
- [ ] Webhook-Verarbeitung verifizieren
- [ ] Bildgenerierung End-to-End testen
- [ ] Alle drei Sprachen verifizieren
