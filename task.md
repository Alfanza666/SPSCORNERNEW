# SPS Corner v5.9.0 — Execution Board

Last updated: 2026-07-12 (Asia/Makassar)  
Baseline: `4b0f3f4` / `v5.8.2`  
Status legend: `DONE` = implemented and locally verified; `IN PROGRESS` = active work; `BLOCKED` = needs external access/decision; `TODO` = not yet implemented.  
Evidence legend: `CODE` = code exists; `LOCAL` = local tests/build passed; `STAGING` / `PRODUCTION` = deployed and verified in that environment.

## Current handoff summary

- Current active task: DOC-001, followed by database/backend foundation.
- Clean baseline before work: yes (`git status --short` returned no changes).
- Baseline automated tests: `npm test` — 10 files, 53 tests passed on 2026-07-12.
- No database migration, VPS deployment, Git commit, push, or production mutation has been performed in this implementation run yet.
- Product decisions and API/data contracts are locked in `implementation-plan.md`.

## Documentation and audit

| ID | Status | Task | Depends on | Files | Evidence / result | Next step |
|---|---|---|---|---|---|---|
| DOC-001 | IN PROGRESS | Create implementation handoff and execution board | — | `implementation-plan.md`, `task.md` | Documents created; repository audit still being incorporated | Update statuses after every implementation/verification stage |
| DOC-002 | TODO | Update README for v5.9 workflow and deployment order | BE/DB/UI completion | `README.md` | — | Document only verified behavior |
| AUDIT-001 | IN PROGRESS | Audit backend, schema, routes, consumers, and legacy compatibility | — | migration 006, workflow route, portal routes, server | Baseline: migration/RSVP exists; publish/scan/doorprize/reporting gaps found | Finish symbol-level consumer map |
| AUDIT-002 | IN PROGRESS | Audit Form Studio, portal, scanner, doorprize, reports, responsiveness | — | admin/portal/form components | Baseline partial map recorded in implementation plan | Finish component-level gap list |
| AUDIT-003 | TODO | Audit dead code and dependencies after consumer migration | completed feature work | repository-wide | Do not delete legacy adapters before this audit | `rg` consumers, then remove only zero-consumer code |

## Database

| ID | Status | Task | Depends on | Files | Evidence / result | Next step |
|---|---|---|---|---|---|---|
| DB-001 | BLOCKED | Backup and audit production Supabase schema/data | environment access + approved backup | external | Prior v5.8.2 handoff reports `PGRST205`; not re-verified this run | Take backup and capture object/constraint inventory before migration |
| DB-002 | TODO | Add idempotent Workflow v5.9 migration | AUDIT-001 | `database/migrations/007_event_workflow_v3.sql` (planned) | — | Add structured program fields, snapshot metadata, lifecycle/audit/RPC support |
| DB-003 | TODO | Verify migration on staging, including rerun/idempotency | DB-002 + staging | external, `task.md` | — | Run twice; inspect constraints/RLS/RPCs and legacy compatibility |
| DB-004 | BLOCKED | Apply and verify migration in production | DB-001, DB-003, deployment authority | external | — | Record backup point, execution time, verification queries, rollback point |

## Backend and API

| ID | Status | Task | Depends on | Files | Evidence / result | Next step |
|---|---|---|---|---|---|---|
| BE-001 | TODO | Program eligibility preview and frozen snapshot service | DB-002 | new modular service + route | — | Resolve NIK/department/join-date combinations server-side |
| BE-002 | TODO | Transactional gathering publish service/API | BE-001, DB-002 | workflow service/routes, `server.ts` | — | Validate form/deadline/recipients; freeze config and snapshot atomically |
| BE-003 | TODO | Registration state guard, draft/autosave, deadline locks | DB-002 | workflow service/route | Existing V2 submit is `CODE`, canonical states incomplete | Add compatibility mapping and tests |
| BE-004 | TODO | Server quote using count-only family package and config snapshot | DB-002 | pricing service, workflow route | Existing server quote is `CODE`; repeater and split family prices remain | Replace family repeater semantics, retain legacy input adapter temporarily |
| BE-005 | TODO | Split employee and family entitlement activation | BE-004 | entitlement service, workflow route | Existing issuance holds all QR until paid | Employee on attending; family on paid; idempotency tests |
| BE-006 | TODO | Rejected-proof replacement and payment review hardening | BE-003 | payment service/routes | Partial `CODE` support exists | Add explicit transition and retry tests |
| BE-007 | TODO | Program/gate-aware scanner and append-only audit | DB-002 | redemption service/routes | Legacy RPC only | Log success/duplicate/rejected/reversed atomically |
| BE-008 | TODO | Reasoned manual attendance override | BE-007 | redemption service/routes | Legacy bypass has no required reason contract | Role/reason/audit tests |
| BE-009 | TODO | Doorprize eligibility from actual attendance | BE-007/008 | doorprize service/routes | Legacy doorprize coupon source | Add read API and compatible draw validation |
| BE-010 | TODO | Unified report aggregate and export endpoints | BE-003–009 | reporting service/routes | — | Dashboard JSON, Excel, branded PDF using existing dependencies/assets |
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
| PORTAL-001 | TODO | Program detail eligibility/deadline/status and retry states | BE-002/003 | `PortalProgram.tsx` | Dynamic-form link and basic coupons exist | Integrate sanitized workflow endpoint |
| PORTAL-002 | TODO | Separate attendance/meal tabs and per-beneficiary lifecycle cards | BE-005 | portal components | Basic mixed coupon grid exists | Add employee + `Keluarga N`, inactive reasons, offline/retry |
| ADMIN-001 | TODO | Program editor structured gathering config and eligibility preview | BE-001/002 | `AdminUnionPrograms.tsx` | Current data is partly metadata/client multi-write | Replace save/publish path incrementally |
| ADMIN-002 | CODE | Payment review list, approve/reject/unlock UI | baseline v5.8.2 | `AdminProgramRegistrationsV2.tsx` | Existing code; full transition QA pending | Integrate rejected replacement/audit details |
| ADMIN-003 | TODO | Scanner program/gate selectors and V2 result history | BE-007 | `AdminScanner.tsx` | Current scanner calls legacy RPC | Integrate endpoint and responsive states |
| ADMIN-004 | TODO | Doorprize UI consumes attendance eligibility API | BE-009 | `AdminDoorprize.tsx` | Current source is `doorprize` coupons | Preserve manual/Excel tabs; replace program tab only |
| ADMIN-005 | TODO | Program report dashboard and filtered exports | BE-010 | admin report page/route | — | Add responsive metrics/tables and downloads |

## QA, cleanup, release, and deployment

| ID | Status | Task | Depends on | Files | Evidence / result | Next step |
|---|---|---|---|---|---|---|
| QA-001 | DONE | Record baseline automated test health | — | existing test suite | `npm test`: 10/10 files, 53/53 tests passed | Re-run after each stage |
| QA-002 | TODO | Add unit/API tests for publication, pricing, state, idempotency | backend work | `src/test/` | — | Cover required acceptance matrix |
| QA-003 | TODO | Add scanner/doorprize/report consistency tests | BE-007–010 | `src/test/` | — | Include wrong gate, duplicate, family/no-doorprize |
| QA-004 | TODO | Form Studio/renderer/AI tests | UI/AI work | `src/test/` | — | Classic/Card branches, graph validation, apply/undo |
| QA-005 | TODO | Run final lint/test/build | all local work | repository | — | Record command output and timestamps here |
| QA-006 | BLOCKED | Manual E2E and responsive/accessibility QA | deployed staging or configured local DB | checklist | — | Mobile/tablet/desktop, dark/light, keyboard, screen reader basics |
| QA-007 | BLOCKED | Regression smoke: kiosk/seller/cart/checkout/PPOB/non-gathering | runnable environment/test data | checklist | — | Record each flow, account, and result |
| CLEAN-001 | TODO | Remove dead repeater/name helpers and zero-consumer legacy state | AUDIT-003, QA | targeted files only | No deletion before consumer audit | List each removal and replacement |
| CLEAN-002 | TODO | Dependency/asset audit | feature completion | `package.json`, assets | No new dependency planned | Remove only proven unused dependencies/assets |
| RELEASE-001 | TODO | Sync v5.9.0 package, homepage, dashboards/portal, changelog/error history | QA-005 | version/UI/docs files | Baseline is v5.8.2 | Apply once implementation is locally complete |
| DEPLOY-001 | BLOCKED | Deploy migration, backend VPS, frontend, then verify | DB-003, QA-005, external access | VPS/Vercel/Supabase | Not attempted | Follow required ordered checklist; do not skip backup |
| DEPLOY-002 | BLOCKED | Record commit/push, VPS health JSON, PM2 errors, Vercel smoke, rollback point | DEPLOY-001 | `task.md` | — | Paste commit and sanitized evidence |

## Required final verification matrix

- [ ] Gathering publish rejects missing form, deadline, deadline-after-start, or empty recipients.
- [ ] NIK, department, join-date, and combined filters freeze the expected snapshot.
- [ ] Out-of-snapshot user cannot RSVP or get QR.
- [ ] Declined ends with no entitlement.
- [ ] Attending immediately has employee attendance and meal QR even with pending additions.
- [ ] XXL/XXXL and family count use server config-version prices.
- [ ] Zero family produces no family item/QR; N produces exactly N attendance and N meal after paid.
- [ ] Transfer and manual QRIS can be reviewed; rejected proof can be replaced.
- [ ] Retry/double approval/double callback creates no duplicate payment or QR.
- [ ] Wrong gate rejects and logs; second scan logs duplicate.
- [ ] Employee-attendance scan/valid override qualifies; meal/family does not.
- [ ] Override without valid role/reason rejects.
- [ ] Deadline/paid/scanned/locked registration edit rejects.
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
