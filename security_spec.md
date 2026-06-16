# Security Specification & "Dirty Dozen" Payloads

## 1. Data Invariants
- **Artisan Identity Integrity**: An artisan document can only be created by an authenticated user whose `ownerId` and `id` match their authentic `request.auth.uid`. No user can claim to be another artisan or create another artisan profile.
- **Product Relational Authenticity**: Any product document listed must belong to an existing registered `artisan` profile, where the product's `ownerId` matches the authenticated creator's `ownerId`.
- **Order Isolation**: A user's order must be completely private. Only the buyer (the user who placed the order represented by `buyerId`) and the admin or system processes can view it. In addition, listings can be updated by their owner.
- **Review Integrity**: Product review profiles can only be written by registered buyers. A user can only write products' reviews using their authentic `buyerId` (no spoofing). At creation, ratings must be strictly between 1 and 5.
- **Immutability of Key Metadata**: Historic fields like `createdAt`, `buyerId`, and `ownerId` cannot be updated after creation.
- **Temporal Enforcement**: Fields like `createdAt` and `updatedAt` must be set to `request.time`. Client-supplied values are strictly rejected.

---

## 2. "Dirty Dozen" Payloads (The Red Team Vectors)

1. **Artisan Impersonation (Identity Spoofing)**
   User tries to register an artisan profile with their own document ID but claims `ownerId: "victim_user_123"` to piggyback permissions.
   - *Expected:* `PERMISSION_DENIED` (ownerId must match authentic UID).

2. **Artisan Phantom Field Injection**
   User sends an extra unvalidated key, `isPlatformVerified: true`, during artisan profile creation.
   - *Expected:* `PERMISSION_DENIED` (Keys length and names must strictly match properties list).

3. **Product Orphan Creation**
   User lists a product that specifies `artisanId: "non_existent_artisan_abc"` or a competitor's artisan ID.
   - *Expected:* `PERMISSION_DENIED` (referenced artisan profile must exist in the database via `exists()`).

4. **Product Competitor Spoofing**
   User tries to list a product with `ownerId: "another_artisan_uid"`.
   - *Expected:* `PERMISSION_DENIED` (product's `ownerId` must equal `request.auth.uid`).

5. **Competitive Product Sabotage (Unauthorized Price Update)**
   Artisan A submits an update target at Product B (owned by Artisan B) trying to drop its price to $1.00.
   - *Expected:* `PERMISSION_DENIED` (only owner of the product can modify it).

6. **Order PII Snoop (Unauthorized Read)**
   Regular buyer `customer_A_uid` attempts to retrieve order `/orders/some_other_buyers_order_id` belonging to `customer_B_uid`.
   - *Expected:* `PERMISSION_DENIED` (order reads restricted to `resource.data.buyerId == request.auth.uid`).

7. **Order Fake Success Injection**
   An unprivileged client attempts to update an order, switching `paymentStatus` directly from `"pending"` to `"succeeded"` without going through a verified checkout flow.
   - *Expected:* `PERMISSION_DENIED` (clients cannot edit orders once created).

8. **System Field Hijacking (Order Transaction Injection)**
   A buyer creates an order but manually sets `transactionId` to `"test_free_pass_123"` and `totalAmount` to `$1.00` for a $1,000 cart.
   - *Expected:* `PERMISSION_DENIED` (total count and order structure are validated, and clients cannot inject random fields).

9. **Review Identity Spoofing**
   An anonymous user or Buyer A tries to write a product review under `buyerId: "Buyer_B"`.
   - *Expected:* `PERMISSION_DENIED` (review writer ID must match actual authentic UID).

10. **Review Out-of-Bounds Poisoning**
    User posts a product review with `rating: 100` or a comment size over 5,000 characters.
    - *Expected:* `PERMISSION_DENIED` (rating must be `>= 1 && <= 5` and comment length must be bounded).

11. **Historic Timestamp Forgery**
    User tries to edit `createdAt` on an existing product, updating it back to five years ago to alter sort sequences.
    - *Expected:* `PERMISSION_DENIED` (immutable field rule blocks modifications to `createdAt`).

12. **Malicious ID Injection (Path Poisoning)**
    An attacker attempts to create a product using a massive, 20KB garbage character string as the document ID to disrupt database queries.
    - *Expected:* `PERMISSION_DENIED` (ID must match the safe regex and size constraints).
