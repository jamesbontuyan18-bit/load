# James Load Services — Prepaid Load Reseller Web Application

A complete, production-grade prepaid load reseller web platform in the Philippines featuring direct payments per purchase, automated carrier fulfillment, customer order tracking, and administrator profit management.

---

## Key Features

### 1. Customer Application
- **Philippine Telco Catalog**: Support for Globe, TM (Touch Mobile), Smart, TNT (Talk 'N Text), and DITO Telecommunity.
- **Auto Carrier Detection**: Automatically recognizes network carrier as soon as the recipient inputs an 11-digit mobile number (`09XXXXXXXXX`).
- **Direct Payment Per Order**: No customer wallet deposit or balance lock-in. Direct checkout via GCash, Maya, Debit/Credit Card, or Manual Transfer.
- **Authoritative Price Validation**: Authoritative pricing retrieved directly from backend records to prevent client-side price tampering.
- **Real-Time Order Tracking**: Multi-step stepper tracking order creation, verified payment, and carrier e-load delivery with SMS confirmation reference.
- **Customer Dashboard**: Overview of verified total spent (₱), load packages received, and filterable order history.
- **Customer Support Ticketing**: Order-specific issue reporting and status resolution tracking.

### 2. Administrator & Reseller Console
- **Financial Accounting & Profit Reporting**:
  - Real-time gross sales (₱)
  - Wholesale provider costs (₱)
  - Payment gateway processing fees (₱)
  - Refund tracking (₱)
  - Realized net profit (₱) and expected gross margin (₱)
- **Order Management & Reconciliation**:
  - Filterable by carrier network and transaction status.
  - Verification & approval of manual GCash payments with automatic load delivery trigger.
  - Safe fulfillment retry for carrier timeouts.
  - Safe refund processing with automatic reversal ledger entries.
- **Product & Promo Catalog Editor**:
  - Create and edit promos, set face value, customer selling price, and provider wholesale cost.
  - Real-time profit margin (₱ and %) calculator.
  - Enable or disable products.
  - Pre-seeded with official Philippine telco promos (Go50, Go90, GIGA Power 149, Magic Data 99, DITO Level-Up 99, etc.).
- **Immutable Financial Ledger**:
  - Event-sourced accounting ledger with integer centavos precision.
- **Reseller Store Settings**:
  - Business name, customer service contacts, manual GCash and Maya recipient account details, and announcement banner.

---

## Technology Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **Backend & Database**: Firebase Cloud Firestore, Firebase Authentication
- **Security**: Zero-Trust Firestore Security Rules (`firestore.rules`)
- **Payment Abstraction**: Direct checkout with support for PayMongo, Xendit, GCash, Maya, and manual QR verification.
- **Provider Abstraction**: Reseller E-load API adapter with idempotency guards to eliminate duplicate delivery.

---

## Setup & Deployment Guide

### 1. Firebase Provisioning
Firebase Firestore and Authentication are provisioned and configured in `firebase-applet-config.json` with Firestore Database ID: `ai-studio-jamesloadservice-c402e352-093d-4986-965c-2f19ab15be2f`.

Security rules are deployed via `DeployRules` with rules version 2 in `firestore.rules`.

### 2. Administrator Access
The user email configured in the runtime environment (`jamesbontuyan84@gmail.com`) automatically receives full administrator privileges across the console, order management, financial ledger, and catalog editor.

### 3. Payment Gateway Configuration (Production)
For live payments via PayMongo or Xendit:
1. Register a merchant account with PayMongo or Xendit.
2. Obtain public & secret API keys.
3. Configure webhook URL pointing to your server/Cloud Functions endpoint.
4. Set secrets in Firebase Functions / server environment.

### 4. Prepaid Load Provider Configuration (Production)
To connect to an authorized telco load distributor or aggregator (e.g., LoadCentral, Telepono, or direct carrier APIs):
1. Register as an authorized reseller with your distributor.
2. Store your Reseller API Key and Distributor PIN in server environment variables.
3. Replace the sandbox delay in `src/services/providerService.ts` with the authorized HTTP POST call to the distributor's E-Load endpoint.
