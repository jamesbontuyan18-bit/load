# James Load Services — Security Specification & Rule Audit

## 1. Architectural Principles
- **Direct Payment Per Order**: Every purchase has an isolated payment and order cycle. No persistent customer wallet or arbitrary top-up balance exists, eliminating wallet drain and balance forgery attack surfaces.
- **Backend-Authoritative Pricing**: Customers cannot submit or mutate product prices. The selling price and provider cost are snapshot strictly from authoritative product definitions.
- **Strict Separation of Payment and Fulfillment State**: Only verified `paid` orders are eligible for prepaid load fulfillment. Browser redirects, client-side flags, or unverified claims cannot transition an order to paid or fulfilled.
- **Idempotency & Double-Disbursement Guard**: Load fulfillment checks existing order delivery states to eliminate duplicate carrier airtime disbursement.
- **Data Isolation**: Customers can read and track only their own orders and support tickets. Public tracking requires exact order reference lookup.
- **Admin Zero-Trust Role Guard**: Privileged operations (modifying catalog pricing, manual verification, fulfillment retries, refunds, ledger audits) are restricted to authorized administrators (`jamesbontuyan84@gmail.com` and records in `/admins/{uid}`).

---

## 2. Data Invariants
1. `orders/{orderId}`:
   - Must have a valid `orderReference` matching `^JLS-[0-9]{6}-[A-Z0-9]{5}$`.
   - `sellingPrice` must be greater than zero.
   - Initial state on creation MUST be `paymentStatus: 'pending'` and `fulfillmentStatus: 'not_started'`.
   - Customers may only update `manualPaymentRef` and set `paymentStatus` to `review_required` during pending manual transactions.
   - Customers cannot alter `fulfillmentStatus`, `providerReference`, or pricing snapshots.
2. `payments/{paymentId}`:
   - Must link to a valid `orderId` and `userId`.
   - Writable only by backend or verified transactions.
3. `financialLedger/{entryId}`:
   - Immutable financial events (`GROSS_SALE`, `PROVIDER_COST`, `GATEWAY_FEE`, `REFUND`).
   - Read/write access strictly restricted to administrators. Ordinary users are denied all access.
4. `supportRequests/{requestId}`:
   - Bound to the author `userId`. Non-admin users can only view and update their own tickets.

---

## 3. The "Dirty Dozen" Threat Vectors & Defense Mitigations
1. **Dirty Price Tamper**: Malicious customer submits `sellingPrice: 1` for a ₱1000 load package.
   - *Mitigation*: Handled authoritatively by `createAuthoritativeOrder()`, which pulls pricing from the Firestore product document. Security rules reject creation if `sellingPrice <= 0`.
2. **Ghost Admin Escalation**: Attacker modifies user profile `role: 'admin'`.
   - *Mitigation*: Security rule enforces `incoming().role == existing().role` on customer user update. `isAdmin()` checks runtime email and trusted `/admins` collection.
3. **Spoofed Payment Webhook / Client Redirect Hijack**: Attacker simulates payment return URL directly to mark order as `paid`.
   - *Mitigation*: Only the backend or trusted admin can transition an order to `paid`. Client redirects have zero authority over payment status.
4. **Duplicate Load Fulfillment (Replay Attack)**: Attacker fires rapid checkout requests or double-clicks "Pay".
   - *Mitigation*: Client UI disables buttons during inflight requests. `executeLoadFulfillment()` enforces idempotency: if `fulfillmentStatus === 'successful'`, duplicate delivery is rejected.
5. **PII Scraping via Blanket List Queries**: Attacker runs unrestricted `getDocs(collection(db, 'orders'))`.
   - *Mitigation*: Rule `allow list: if (isSignedIn() && resource.data.userId == request.auth.uid) || isAdmin();` prevents cross-tenant data scraping.
6. **Self-Approved Manual Payment**: Attacker attempts to update order paymentStatus to `paid` with a fake GCash screenshot.
   - *Mitigation*: Security rules restrict customer update keys to `manualPaymentRef`, `notes`, and strictly enforce `incoming().paymentStatus == 'review_required'`. Only admin can transition to `paid`.
7. **Negative or Centavos Precision Loss**: Floats causing rounding drift in reseller profit calculations.
   - *Mitigation*: Integer centavos representation (`amountInCentavos`) stored in financial ledger entries with exact conversions.
8. **Malicious ID Injection (Denial of Wallet)**: Injecting 2MB payload into document paths.
   - *Mitigation*: Helper `isValidId(id)` bounds path IDs to `128` characters with regex `^[a-zA-Z0-9_\-]+$`.
9. **Orphaned Support Tickets**: Attacker creates tickets under another user's `userId`.
   - *Mitigation*: Security rules require `incoming().userId == request.auth.uid`.
10. **Product Catalog Defacement**: Attacker tries to alter promo prices or disable products.
    - *Mitigation*: `products/{productId}` rules enforce `allow write: if isAdmin();`.
11. **Financial Ledger Deletion or Mutation**: Attacker tries to erase gross sale or cost events.
    - *Mitigation*: `financialLedger` is readable and writable exclusively by admins; client code contains no delete routes.
12. **Premature Fulfillment Attempt**: Load dispatch attempted before payment confirmation.
    - *Mitigation*: Provider service asserts `order.paymentStatus === 'paid'` before any carrier API submission.
