# Stripe Webhook Configuration Guide

This guide explains how to configure Stripe webhooks for both Development (Sandbox) and Production (Live) environments.

## Overview

Your `stripe-webhook` Edge Function handles the following events:
- `payment_intent.succeeded` - One-time credit purchases
- `checkout.session.completed` - Legacy checkout flow & subscription creation
- `invoice.payment_succeeded` - Subscription renewals (monthly credits)
- `customer.subscription.updated` - Subscription plan changes
- `customer.subscription.deleted` - Subscription cancellations

---

## Webhook Endpoints

| Environment | Endpoint URL |
|-------------|--------------|
| **Production** | `https://oiorfpkpqmakdakydkgl.supabase.co/functions/v1/stripe-webhook` |
| **Development** | `https://ieabmmzlobwwpxpkpkhg.supabase.co/functions/v1/stripe-webhook` |

---

## Step 1: Create Webhooks in Stripe Dashboard

### Production (Live Mode)

1. Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
2. Ensure you're in **Live mode** (toggle in top-left corner)
3. Click **Add endpoint**
4. Configure:
   - **Endpoint URL**: `https://oiorfpkpqmakdakydkgl.supabase.co/functions/v1/stripe-webhook`
   - **Description**: `DrawToMedia Production`
   - **Select events to listen to**: Click "Select events" and choose:
     - `payment_intent.succeeded`
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
5. Click **Add endpoint**
6. **Copy the Signing secret** (starts with `whsec_`)

### Development (Test Mode)

1. Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Ensure you're in **Test mode** (toggle in top-left corner)
3. Click **Add endpoint**
4. Configure:
   - **Endpoint URL**: `https://ieabmmzlobwwpxpkpkhg.supabase.co/functions/v1/stripe-webhook`
   - **Description**: `DrawToMedia Development`
   - **Select events to listen to**: Click "Select events" and choose:
     - `payment_intent.succeeded`
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
5. Click **Add endpoint**
6. **Copy the Signing secret** (starts with `whsec_`)

---

## Step 2: Configure Supabase Edge Function Secrets

### Production (oiorfpkpqmakdakydkgl)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/oiorfpkpqmakdakydkgl/settings/functions)
2. Navigate to **Project Settings > Edge Functions**
3. Add/update the secret:
   - **Name**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: The signing secret from Step 1 (Production)

### Development (ieabmmzlobwwpxpkpkhg)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/ieabmmzlobwwpxpkpkhg/settings/functions)
2. Navigate to **Project Settings > Edge Functions**
3. Add/update the secret:
   - **Name**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: The signing secret from Step 1 (Development)

---

## Step 3: Verify Configuration

### Test with Stripe CLI (Development)

```bash
# Install Stripe CLI if not already installed
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local development (optional)
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Trigger a test event
stripe trigger payment_intent.succeeded
```

### Verify in Stripe Dashboard

1. Go to your webhook endpoint in Stripe Dashboard
2. Check the **Webhook attempts** tab
3. You should see successful `200` responses

---

## Required Supabase Secrets (Summary)

Ensure these secrets are configured in both Supabase projects:

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key | Stripe Dashboard > API keys |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Created during webhook setup (Step 1) |
| `SUPABASE_URL` | Supabase project URL | Automatically available |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Supabase Dashboard > API settings |

### Production Stripe Keys (Live Mode)
- `STRIPE_SECRET_KEY`: `sk_live_...`
- `STRIPE_WEBHOOK_SECRET`: `whsec_...` (from live webhook)

### Development Stripe Keys (Test Mode)
- `STRIPE_SECRET_KEY`: `sk_test_...`
- `STRIPE_WEBHOOK_SECRET`: `whsec_...` (from test webhook)

---

## Troubleshooting

### Webhook returns 400 "Invalid signature"
- Verify the `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe Dashboard
- Ensure you're using the correct mode (Test/Live) secret for each environment

### Webhook returns 500 "Webhook processing failed"
- Check Supabase Edge Function logs for detailed error
- Verify `STRIPE_SECRET_KEY` is set correctly
- Ensure database tables (`credit_purchases`, `subscriptions`) exist

### Events not being received
- Check Stripe Dashboard > Webhooks > your endpoint > Webhook attempts
- Verify the endpoint URL is accessible (no firewall blocking)
- Ensure the webhook is not in "Disabled" state

---

## Security Best Practices

1. **Never expose webhook secrets** in frontend code or Git
2. **Signature verification** is implemented - never skip this check
3. **Idempotency** - The webhook handler checks for duplicate events
4. **HTTPS only** - Stripe only sends webhooks to HTTPS endpoints
5. **Timestamp tolerance** - Events older than 5 minutes are rejected

---

## Event Flow Diagram

```
Customer Payment
      │
      ▼
┌─────────────────┐
│  Stripe Event   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  stripe-webhook Edge Function               │
│                                             │
│  1. Verify signature (HMAC-SHA256)          │
│  2. Check idempotency (prevent duplicates)  │
│  3. Process event by type                   │
│  4. Update Supabase database                │
│  5. Add credits via RPC function            │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Supabase DB    │
│  - users        │
│  - subscriptions│
│  - credit_purchases│
└─────────────────┘
```

---

Last updated: December 2024
