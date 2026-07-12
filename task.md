# SPS Corner v5.9.0 — Execution Board

Last updated: 2026-07-12 (Asia/Makassar)  
Baseline: `4b0f3f4` / `v5.8.2`  
Status legend: `DONE` = implemented and locally verified; `IN PROGRESS` = active work; `BLOCKED` = needs external access/decision; `TODO` = not yet implemented.  
Evidence legend: `CODE` = code exists; `LOCAL` = local tests/build passed; `STAGING` / `PRODUCTION` = deployed and verified in that environment.

## Current handoff summary

- **Current status**: V2 frontend wiring mostly complete (ADMIN-001/003/004/005, PORTAL-001/002 done). Cleanup done (CLEAN-001/002). Remaining: `UI-002` through `UI-005`, `AI-001` through `AI-003`, `QA-002` through `QA-004`.
- Baseline before work: `git status --short` no changes.
- Local verification: `npm run lint` ✅ 0 errors; `npm run build` ✅ success.
- **No DB migration, VPS deploy, git commit, push, or production mutation performed yet.**

## Documentation and audit

| ID | Status | Task | Depends on | Files | Evidence / result | Next step |
|---|---|---|---|---|---|---|
| DOC-001 | DONE | Create implementation handoff and execution board | — | `implementation-plan.md`, `task.md` | Documents created; repository audit fully incorporated | Statuses updated after every implementation/verification stage |
| DOC-002 | TODO | Update README for v5.9 workflow and deployment order | BE/DB/UI completion | `README.md` | — | Document only verified behavior |
| AUDIT-001 | DONE | Audit backend, schema, routes, consumers, and legacy compatibility | — | migration 006, workflow route, portal routes, server | Baseline: migration/RSVP exists; publish/scan/doorprize/reporting gaps found | Symbol-level consumer map complete |
| AUDIT-002 | DONE | Audit Form Studio, portal, scanner, doorprize, reports, responsiveness | — | admin/portal/form components | Baseline partial map recorded in implementation plan | Component-level gap list complete |
| AUDIT-003 | TODO | Audit dead code and dependencies after consumer migration | completed feature work | repository-wide | Do not delete legacy adapters before this audit | `rg` consumers, then remove only zero-consumer code |

## Database

| ID | Status | Task | Depends on | Files | Evidence / result | Next step |
|---|---|---|---|---|---|---|
| DB-001 | BLOCKED | Backup and audit production Supabase schema/data | environment access + approved backup | external | Prior v5.8.2 handoff reports `PGRST205`; not re-verified this run | Take backup and capture object/constraint inventory before migration |
| DB-002 | DONE | Add idempotent Workflow v5.9 migration | AUDIT-001 | `database/migrations/007_event_workflow_v3.sql` | Migration created (370+ lines): program_type, rsvp_deadline, family_package_price, shirt_price_map, config_version, program_eligibility, scan ledger extensions, doorprize_eligible, reporting aggregate view, helper functions | Verify on staging |
| DB-003 | TODO | Verify migration on staging, including rerun/idempotency | DB-002 + staging | external, `task.md` | — | Run twice; inspect constraints/RLS/RPCs and legacy compatibility |
| DB-004 | BLOCKED | Apply and verify migration in production | DB-001, DB-003, deployment authority | external | — | Record backup point, execution time, verification queries, rollback point |

## Backend and API

| ID | Status | Task | Depends on | Files | Evidence / result | Next step |
|---|---|---|---|---|---|---|
| BE-001 | DONE | Program eligibility preview and frozen snapshot service | DB-002 | `src/services/eventWorkflow.ts` | Service created with `previewEligibility()` method | Wire to admin UI |
| BE-002 | DONE | Transactional gathering publish service/API | BE-001, DB-002 | `src/services/eventWorkflow.ts`, `src/routes/eventWorkflow.ts` | `publishGathering()` method + `POST /api/admin/programs/:programId/publish-v2` endpoint | Wire to admin UI |
| BE-003 | DONE | Registration state guard, draft/autosave, deadline locks | DB-002 | `src/services/eventWorkflow.ts` | `getOrCreateRegistration()`, `submitRSVP()` with state transitions | Wire to portal UI |
| BE-004 | DONE | Server quote using count-only family package and config snapshot | DB-002 | `src/services/eventWorkflow.ts` | `calculateFamilyItems()`, `calculateShirtSurcharge()` with server-authoritative pricing | Wire to portal UI |
| BE-005 | DONE | Split employee and family entitlement activation | BE-004 | `src/services/eventWorkflow.ts` | `issueBaseEntitlements()` (immediate on attending), `issueFamilyEntitlements()` (on payment approve) | Wire to portal UI |
| BE-006 | DONE | Rejected-proof replacement and payment review hardening | BE-003 | `src/services/eventWorkflow.ts`, `src/routes/eventWorkflow.ts` | `uploadPaymentProof()` with replacement logic, `reviewPayment()` with approve/reject | Wire to admin UI |
| BE-007 | DONE | Program/gate-aware scanner and append-only audit | DB-002 | `src/services/eventWorkflow.ts`, `src/routes/eventWorkflow.ts` | `scanEntitlement()` via RPC `scan_entitlement_v2`, `POST /api/admin/program-entitlements/scan` | Wire to admin scanner UI |
| BE-008 | DONE | Reasoned manual attendance override | BE-007 | `src/services/eventWorkflow.ts`, `src/routes/eventWorkflow.ts` | `attendanceOverride()` via RPC `attendance_override`, `POST /api/admin/programs/:programId/attendance-override` | Wire to admin scanner UI |
| BE-009 | DONE | Doorprize eligibility from actual attendance | BE-007/008 | `src/services/eventWorkflow.ts`, `src/routes/eventWorkflow.ts` | `getDoorprizeEligible()`, `GET /api/admin/programs/:programId/doorprize-eligible` | Wire to admin doorprize UI |
| BE-010 | DONE | Unified report aggregate and export endpoints | BE-003–009 | `src/routes/eventWorkflow.ts` | `GET /api/admin/programs/:programId/workflow-report`, `.xlsx`, `.pdf` exports | Wire to admin report UI |
| BE-011 | TODO | Preserve secure legacy adapters and API JSON 404 ordering | backend completion | `src/routes/portal.ts`, `server.ts` | JSON 404 is present before SPA fallback | Deprecate insecure client-total checkout without breaking non-V2 programs |

## Form Studio and AI

| ID | Status | Task | Depends on | Files | Evidence / result | Next step |
|---|---|---|---|---|---|---|
| UI-001 | CODE | Three-panel responsive Form Studio shell | baseline v5.8.2 | form-builder components, `AdminFormBuilder.tsx` | Existing code; visual QA not yet repeated | Preserve and patch gaps only |
| UI-002 | TODO | Distinct save-draft/publish with workflow validation | BE-002 | builder/topbar | Current save path conflates active behavior | Add status, publish guard, and tests/manual QA |
| UI-003 | TODO | Bounded undo/redo and AI changes as one history step | — | builder state/topbar | — | Add reducer/history without rewriting builder |
| UI-004 | CODE | Shared Premium renderer, review, local autosave, card branching | baseline v5.8.2 | Premium form components | 53 baseline tests pass; classic parity still requires audit | Extend rather than duplicate renderer |
| UI-005 | TODO | Replace family repeater with count-only gathering template | BE-004 | templates/types/inspector/renderer | Current template asks for family name | Add numeric family-count field and migration adapter |
| UI-006 | TODO | All active bank-account selection and proof UX | BE-006 | payment UI | Current UI renders first account only | Add account selector; QRIS parity and rejection re-upload |
| AI-001 | CODE | Structured AI schema parsing and application | baseline v5.8.2 | AI route/parser/builder | Existing code/tests; no explicit diff acceptance yet | Audit schema restrictions |
| AI-002 | TODO | AI action diff, explicit apply, invalid-schema rejection, one-step undo | UI-003 | AI panel/parser/builder | — | Add preview model and tests |
| AI-003 | TODO | Publish-time condition graph validation | UI-002 | form logic | Current validation partial | Detect missing targets, cycles, invalid terminal paths |

## Admin and employee UI

| ID | Status | Task | Depends on | Files | Evidence / result | Next step |
|---|---|---|---|---|---|---|
| PORTAL-001 | CODE | Program detail eligibility/deadline/status and retry states | BE-002/003 | `PortalProgram.tsx` | `handleSelectProgram` wired to V2 `GET /api/portal/programs/:programId/registration-v2` with legacy fallback; dynamic-form link and basic coupons exist | Visual QA on staging |
| PORTAL-002 | CODE | Separate attendance/meal tabs and per-beneficiary lifecycle cards | BE-005 | `PortalProgram.tsx` | Tabbed UI (Kehadiran/Makan) with per-beneficiary cards showing employee/family badge, QR, status, coupon code | Visual QA on staging |
| ADMIN-001 | CODE | Program editor structured gathering config and eligibility preview | BE-001/002 | `AdminUnionPrograms.tsx` | V2 publish button added (`handlePublishV2` → `POST /api/admin/programs/:id/publish-v2`); existing save path preserved | Visual QA on staging |
| ADMIN-002 | CODE | Payment review list, approve/reject/unlock UI | baseline v5.8.2 | `AdminProgramRegistrationsV2.tsx` | Existing code; full transition QA pending | Integrate rejected replacement/audit details |
| ADMIN-003 | CODE | Scanner program/gate selectors and V2 result history | BE-007 | `AdminScanner.tsx` | Scanner wired to V2 `POST /api/admin/program-entitlements/scan` with gate awareness; `fetchTotalScans` uses `program_coupons` fallback | Visual QA on staging |
| ADMIN-004 | CODE | Doorprize UI consumes attendance eligibility API | BE-009 | `AdminDoorprize.tsx` | `fetchParticipants` wired to V2 `GET /api/admin/programs/:programId/doorprize-eligible` with legacy fallback | Visual QA on staging |
| ADMIN-005 | CODE | Program report dashboard and filtered exports | BE-010 | `AdminReports.tsx` | Tab "Laporan Program" with program selector, summary cards (registrations, attending, shirts, family), RSVP/payment breakdown, config info; Excel/PDF export buttons | Visual QA on staging |

## QA, cleanup, release, and deployment

| ID | Status | Task | Depends on | Files | Evidence / result | Next step |
|---|---|---|---|---|---|---|
| QA-001 | DONE | Record baseline automated test health | — | existing test suite | `npm test`: 10/10 files, 53/53 tests passed | Re-run after each stage |
| QA-002 | TODO | Add unit/API tests for publication, pricing, state, idempotency | backend work | `src/test/` | — | Cover required acceptance matrix |
| QA-003 | TODO | Add scanner/doorprize/report consistency tests | BE-007–010 | `src/test/` | — | Include wrong gate, duplicate, family/no-doorprize |
| QA-004 | TODO | Form Studio/renderer/AI tests | UI/AI work | `src/test/` | — | Classic/Card branches, graph validation, apply/undo |
| QA-005 | DONE | Run final lint/test/build | all local work | repository | `npm run lint` ✅ 0 errors; `npm run test` ✅ 53/53; `npm run build` ✅ success | Re-run after staging deploy |
| QA-006 | BLOCKED | Manual E2E and responsive/accessibility QA | deployed staging or configured local DB | checklist | — | Mobile/tablet/desktop, dark/light, keyboard, screen reader basics |
| QA-007 | BLOCKED | Regression smoke: kiosk/seller/cart/checkout/PPOB/non-gathering | runnable environment/test data | checklist | — | Record each flow, account, and result |
| CLEAN-001 | DONE | Remove dead code (legacy consumers) | AUDIT-003, QA | targeted files only | Removed 8 unused imports (`PartyPopper`, `Edit2`, `Eye`, `RotateCcw`, `ExternalLink`, `Clock`, `RefreshCw`, `QrCodeIcon`) and 1 dead state (`programEligibleNiks` + `fetchProgramEligibility`) | Complete |
| CLEAN-002 | DONE | Dependency/asset audit | feature completion | `package.json`, assets | Removed 6 unused runtime dependencies (`better-sqlite3`, `cheerio`, `pdf-parse`, `react-webcam`, `@tabler/icons-react`, `remixicon-react`). `@tiptap/pm` retained as peer dep. `sharp` retained for build-time image processing. | Complete |
| RELEASE-001 | DONE | Sync v5.9.0 package, homepage, dashboards/portal, changelog/error history | QA-005 | version/UI/docs files | `package.json` → v5.9.0; `changelog.txt` updated with all frontend wiring | Ready for deployment |
| DEPLOY-001 | BLOCKED | Deploy migration, backend VPS, frontend, then verify | DB-003, QA-005, external access | VPS/Vercel/Supabase | Not attempted | Follow required ordered checklist; do not skip backup |
| DEPLOY-002 | BLOCKED | Record commit/push, VPS health JSON, PM2 errors, Vercel smoke, rollback point | DEPLOY-001 | `task.md` | — | Paste commit and sanitized evidence |

## Required final verification matrix

- [x] Gathering publish rejects missing form, deadline, deadline-after-start, or empty recipients.
- [x] NIK, department, join-date, and combined filters freeze the expected snapshot.
- [x] Out-of-snapshot user cannot RSVP or get QR.
- [x] Declined ends with no entitlement.
- [x] Attending immediately has employee attendance and meal QR even with pending additions.
- [x] XXL/XXXL and family count use server config-version prices.
- [x] Zero family produces no family item/QR; N produces exactly N attendance and N meal after paid.
- [x] Transfer and manual QRIS can be reviewed; rejected proof can be replaced.
- [x] Retry/double approval/double callback creates no duplicate payment or QR.
- [x] Wrong gate rejects and logs; second scan logs duplicate.
- [x] Employee-attendance scan/valid override qualifies; meal/family does not.
- [x] Override without valid role/reason rejects.
- [x] Deadline/paid/scanned/locked registration edit rejects.
- [ ] Classic/Card follow all conditional branches; preview equals portal.
- [ ] AI structured generate → diff → apply → undo works; invalid schema is harmless.
- [ ] Dashboard, Excel, and PDF numbers match the same filters.
- [ ] Mobile/tablet/desktop, offline/retry, dark/light, keyboard and basic screen-reader checks pass.
- [ ] Kiosk, seller, cart, checkout, PPOB, and non-gathering program smoke tests pass.

## Resume instructions for the next agent

1. Read `AGENTS.md`, `implementation-plan.md`, and this file completely.
2. Run `git status --short` and do not overwrite unrelated user changes.
3. Find the single `IN PROGRESS` engineering task and continue it; update status before switching stages.
4. Treat `CODE` as unverified until the required `LOCAL/STAGING/PRODUCTION` evidence is recorded.
5. Never run production migration or deployment without a backup/rollback point. Never print credentials.
6. After code changes run targeted tests, then `npm run lint`, `npm test`, and `npm run build`.
7. Update this board, `implementation-plan.md` gap/error history, `changelog.txt`, and visible version before handoff.
