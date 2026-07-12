# Program Form Workflow V2 — Schema and Deployment Notes

> [!IMPORTANT]
> Dokumen ini adalah catatan schema historis untuk implementasi v5.8.x. Untuk
> pekerjaan v5.9.0, `implementation-plan.md` adalah sumber keputusan produk dan
> kontrak engineering, sedangkan `task.md` adalah sumber status/verifikasi.
> Keputusan v5.9 yang menggantikan aturan di bawah mencakup data keluarga
> count-only, entitlement dasar karyawan yang aktif segera setelah RSVP hadir,
> entitlement keluarga yang menunggu pembayaran, dan rollout melalui migration
> idempotent yang diverifikasi di staging. Jangan menjalankan migration production
> hanya berdasarkan dokumen historis ini.

Migration: `database/migrations/006_program_registration_workflow_v2.sql`

## Purpose

This schema connects a dynamic form response to an auditable program RSVP, optional charges, payment settlement, and employee/family coupon entitlements. It is additive: the migration does not rename or delete legacy program, form, response, or coupon columns.

The migration creates:

- `program_workflow_configs` — versioned semantic field bindings and server rules.
- `program_registrations` — one RSVP aggregate per program and NIK/user.
- `program_registration_items` — server-calculated price snapshots.
- `program_registration_payments` — manual bank-transfer/static-QRIS verification ledger.
- `program_coupon_redemptions` — append-only scan audit.
- Optional V2 relation and entitlement columns on the existing `program_coupons` table.

## Required pre-existing tables

The migration expects these tables because the current application already reads or writes them:

- `public.profiles`
- `public.union_programs`
- `public.dynamic_forms`
- `public.dynamic_form_responses`
- `public.program_coupons`

It deliberately does not assume whether the legacy coupon code/type columns are named `qr_code`/`coupon_type` or `coupon_code`/`gate_type`. V2 uses the new neutral `entitlement_code` and relation columns without changing either legacy contract.

The redemption-to-coupon foreign key is added only when `program_coupons.id` is confirmed to be a UUID. If production uses a different key type, the audit table remains usable through `scanned_code`, but the key type must be reconciled in a follow-up migration.

## Recommended workflow configuration

Create a new inactive config, validate it, then make it the only active config for the program. The partial unique index guarantees that a program cannot have two active workflow versions.

Example configuration shape:

```json
{
  "field_bindings": {
    "attendance": "field-attendance",
    "shirt_size": "field-shirt-size",
    "camping": "field-camping",
    "bringing_family": "field-bringing-family",
    "family_count": "field-family-count"
  },
  "pricing_rules": {
    "currency": "IDR",
    "shirt_surcharge": {
      "S": 0,
      "M": 0,
      "L": 0,
      "XL": 0,
      "XXL": 0,
      "XXXL": 0
    },
    "family": {
      "entry_unit_price": 30000,
      "meal_unit_price": 0,
      "max_members": 5
    }
  },
  "entitlement_rules": {
    "employee": ["attendance", "meal"],
    "family": ["attendance", "meal"],
    "one_coupon_per_family_member": true
  },
  "payment_rules": {
    "provider": "manual",
    "method": "manual_transfer_or_qris",
    "qris_image_url": "https://...",
    "account_name": "Panitia SPS",
    "account_number": "...",
    "proof_required": true,
    "hold_entitlements_until_paid": true
  }
}
```

The values above are examples, not production prices. Confirm XXL/XXXL surcharges, whether Rp30,000 includes food, and the maximum family count before activating the config.

## Server-side consistency boundary

Authenticated admins may create or update program workflow configuration from
the builder through admin-only RLS policies. Respondent browsers never write
the transactional workflow tables directly. The Express workflow route
performs retry-safe, idempotent orchestration for registrations, price items,
payments, and coupon issuance:

1. Authenticates the current user and loads their NIK from trusted profile/employee data.
2. Locks the active workflow configuration for the selected program.
3. Checks eligibility, form availability, RSVP deadline, and prior registration.
4. Evaluates only visible conditional fields.
5. Calculates prices from `pricing_rules`; ignores browser totals.
6. Upserts `dynamic_form_responses` and `program_registrations` idempotently.
7. Replaces `program_registration_items` with the server-calculated snapshot.
8. If total is zero, confirms the registration and issues allowed entitlements.
9. If total is positive, creates a pending payment with a unique idempotency key.

Only an authenticated admin approval endpoint can settle `program_registration_payments`. Coupon issuance is separately idempotent, so a safe retry repairs a partial network/database interruption without creating duplicate entitlements. A browser button such as “Saya Sudah Bayar” never marks a payment paid or issues coupons.

## Backend V2 endpoint contract

All portal endpoints require `Authorization: Bearer <access_token>`. Identity, NIK, eligibility, prices, and totals are resolved by the backend; clients must never submit trusted identity or total fields.

### Submit RSVP

`POST /api/portal/programs/:programId/registration-v2/submit`

```json
{
  "answers": {
    "field-attendance": "yes",
    "field-shirt-size": "XXL"
  }
}
```

Returns HTTP `201` for the first registration and `200` for an update/retry:

```json
{
  "success": true,
  "data": {
    "id": "registration-uuid",
    "attendance_status": "attending",
    "registration_status": "pending_payment",
    "payment_status": "pending",
    "total_amount": 30000,
    "items": [],
    "payments": [],
    "coupons": []
  },
  "payment": {},
  "payment_instructions": {},
  "idempotent": false
}
```

A declined RSVP is confirmed with zero total and no coupons. A free attending RSVP is confirmed and receives employee entitlements immediately. A paid RSVP remains without new entitlements until admin approval.

### Read own status

`GET /api/portal/programs/:programId/registration-v2`

Returns `{ success, data, payment_instructions, participant }`; `data` is `null` before the first submission.

### Record manual transfer/static QRIS proof

`POST /api/portal/programs/:programId/registration-v2/payment-proof`

```json
{
  "paymentId": "payment-uuid",
  "proofUrl": "https://project.supabase.co/storage/v1/object/public/program-files/...",
  "declaredAmount": 30000
}
```

The file must be uploaded to controlled storage first. This endpoint records an HTTPS URL or safe storage path and moves the payment to `under_review`; it does not accept base64 or mark a payment paid.

### Admin review

- `GET /api/admin/program-registrations-v2?programId=&attendanceStatus=&paymentStatus=&registrationStatus=&limit=&offset=`
- `POST /api/admin/program-registrations-v2/:registrationId/payments/:paymentId/approve`
- `POST /api/admin/program-registrations-v2/:registrationId/payments/:paymentId/reject`
- `POST /api/admin/program-registrations-v2/:registrationId/unlock`

Approve body: `{ "paidAmount": 30000, "note": "optional" }`.

Reject body: `{ "reason": "required rejection reason" }`.

Unlock body: `{ "reason": "required audit reason" }`. Unlock is limited to non-paid registrations whose coupons have never been claimed; paid corrections require a reviewed refund/reconciliation process.

Approval is retry-safe and issues separate attendance and meal coupons for the employee and each family member. Current coupon responses may contain `coupon_code`/`gate_type`, legacy `qr_code`/`coupon_type`, or both. Consumers should prefer `entitlement_code`, then fall back to the legacy type column.

## RSVP and entitlement state model

- Declined RSVP: `attendance_status=declined`, `registration_status=confirmed`, `payment_status=not_required`, no coupons.
- Attending with zero additional charge: `attendance_status=attending`, `registration_status=confirmed`, `payment_status=not_required`.
- Attending with a charge: `registration_status=pending_payment`, `payment_status=pending` until verified settlement.
- Paid: `registration_status=confirmed`, `payment_status=paid`; issue the missing entitlements idempotently.
- Cancelled/refunded registrations do not delete audit records. Revoke/expire entitlements using the canonical legacy status mechanism and append correction metadata.

For traceability, generate separate coupon rows for:

- Employee attendance.
- Employee meal.
- Family member 1 attendance and meal.
- Family member 2 attendance and meal, and so on.

Use `beneficiary_type=family` and a 1-based `beneficiary_index`. The unique entitlement index prevents duplicate issuance during callback retries.

## Scan audit behavior

`program_coupon_redemptions` is append-only at the application level:

- First accepted scan: `success`.
- Repeated scan: `duplicate`.
- Invalid, expired, wrong-gate, or unpaid scan: `rejected` with `failure_reason`.
- Correction: append `reversed` referencing the original success row.

Do not update or delete successful audit rows. The partial unique index permits only one successful redemption per coupon while still allowing rejected/duplicate attempts to be recorded.

## RLS assumptions

- Admin and superadmin access is resolved from `public.profiles.role` through `is_program_workflow_admin()`.
- Authenticated employees can read only their own registration, items, payments, and scan history.
- Employees have no direct insert/update/delete policy. Writes must use trusted backend code or a narrowly scoped `SECURITY DEFINER` RPC.
- `service_role` is intended only for backend execution and must never be sent to the frontend.

## Rollout order

1. Take a production database backup.
2. Run migration `006` in a staging Supabase project.
3. Confirm the conditional coupon foreign key exists with `\d public.program_coupon_redemptions` or the Supabase schema inspector.
4. Create and validate one inactive workflow config.
5. Deploy transactional RSVP/payment/coupon backend code.
6. Test repeated submit, repeated callback, duplicate scan, refund, and family count boundaries.
7. Activate the V2 workflow for one pilot program.
8. Keep legacy program flows active for programs without an active V2 config.

The migration performs no automatic backfill and does not activate V2 for existing programs.

## Rollback assumptions

Before application writes begin, rollback can safely:

1. Drop the five V2 tables in dependency order.
2. Drop the V2 indexes/constraints and seven added columns from `program_coupons`.
3. Drop `is_program_workflow_admin()` and `set_program_workflow_updated_at()`.

After registrations, payments, coupons, or scans exist, export and reconcile them before rollback. Dropping the V2 relation columns would sever the audit trail even though legacy coupons remain.

Suggested rollback dependency order:

```sql
DROP TABLE IF EXISTS public.program_coupon_redemptions;

ALTER TABLE public.program_coupons
  DROP COLUMN IF EXISTS program_registration_item_id,
  DROP COLUMN IF EXISTS program_registration_id,
  DROP COLUMN IF EXISTS beneficiary_type,
  DROP COLUMN IF EXISTS beneficiary_index,
  DROP COLUMN IF EXISTS entitlement_code,
  DROP COLUMN IF EXISTS entitlement_metadata,
  DROP COLUMN IF EXISTS issued_at;

DROP TABLE IF EXISTS public.program_registration_payments;
DROP TABLE IF EXISTS public.program_registration_items;
DROP TABLE IF EXISTS public.program_registrations;
DROP TABLE IF EXISTS public.program_workflow_configs;
DROP FUNCTION IF EXISTS public.is_program_workflow_admin();
DROP FUNCTION IF EXISTS public.set_program_workflow_updated_at();
```

Do not execute that rollback once V2 is live without a reviewed data migration plan.
