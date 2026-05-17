# Changelog SPS Corner - Push Method Update

## [Version 4.7.0] - 2026-05-18

### 🚀 Features Implemented

#### 1. Push Method Core Architecture
- **Database Schema**: Implemented `program_coupons` table to replace manual registration.
- **RPC Functions**:
    - `generate_program_coupons`: Auto-distribute coupons based on NIK list.
    - `generate_manual_coupon`: Manual entry for external affiliates.
    - `claim_program_coupon`: Logic for scanning (Gate 1 & 2 auto-generation).
    - `bypass_attendance_coupon`: Issue doorprize tickets remotely for outer-city employees.

#### 2. Admin Interface
- **AdminUnionPrograms**: Auto-generate coupons upon program creation when target NIKs are uploaded.
- **AdminProgramCoupons**:
    - New dashboard for managing coupons.
    - Bulk generation via text input.
    - Manual generation modal.
    - Live table monitoring with filters (Type, Status).
    - Bypass action per row.
- **AdminScanner**:
    - Real-time camera scanner using `html5-qrcode`.
    - Dynamic feedback toast (e.g., "Berhasil! Budi (123) Presensi").
    - Visual overlay for scanning area.
- **AdminDoorprize**:
    - New Spin Wheel UI.
    - Draw logic from `program_coupons` (type: doorprize).
    - Winner logging to `program_doorprize_log`.

#### 3. User Portal (Employee)
- **PortalProgram**:
    - Redesigned to show "My Tickets" instead of "Register".
    - Fetch data from `program_coupons`.
    - **QR Code**: Implemented real QR rendering using `react-qr-code`.
    - **Ticket Details**: Shows Name, NIK, Gate Type clearly.
    - **Inline Form**: Simplified form modal for filling Polling/Add-ons directly on the ticket page.

#### 4. Form Builder Enhancements
- Added support for `image_choice` (Polling with images).
- Added `addon_group` logic for ordering extras (Size + Qty).
- Updated `AdminFormBuilder` to support these advanced types.

### 🛠️ Bug Fixes & Improvements

- **UUID Handling**: Fixed `invalid input syntax for type uuid` in `AdminUnionPrograms` by sanitizing empty strings to null.
- **Scanner Logic**: Removed legacy fallback logic in `AdminScanner` that was incompatible with the new schema (caused crashes).
- **Routing**: Fixed sidebar link for Doorprize page to point to correct route.
- **Package**: Added `react-qr-code` for visual ticket rendering.

### 📝 Notes

- Admin must enable `allow_gate2_auto_generation` in Program Settings for auto meal/doorprize ticket generation.
- Make sure to run the SQL migration scripts provided in previous steps to create tables and functions.

---

## [Version 4.7.1] - 2026-05-18 (Hotfix / UI Refactor)

### 🛠️ Bug Fixes & Improvements

- **PortalProgram UI**: Complete overhaul of the user interface to support dynamic logic based on Program Type.
    - **Logic Kurban**: Checks eligibility (presence of coupons). If eligible, shows "Kupon Pengambilan Daging Kurban" QR Code. If not eligible, shows "Dikhususkan bagi Operative" message.
    - **Logic Gathering**: Dynamic stages based on `form_config`.
        - If `form_config` exists: Shows Form first -> "Konfirmasi Hadir" button -> QR Kehadiran.
        - If `form_config` empty: Shows "Konfirmasi Hadir" directly.
        - If Attendance claimed: Shows benefit cards (QR Makan & Nomor Undian Doorprize).
    - **Clean Up**: Removed all "KODE RESERVASI" placeholders. Used real `react-qr-code` library.
    - **UI Polish**: Tech Minimalist card design for program list.

### 🆕 Feature: Family Payment & iPaymu Integration
- **PortalProgram**:
    - Added "Bawa Anggota Keluarga" section in Gathering.
    - **Real Implementation**: Connects to `/api/portal/programs/:id/checkout-family`.
    - **Real QRIS Rendering**: Uses `<QRCode />` component to render the actual string from API response, not placeholder image.
    - Includes "Saya Sudah Bayar" confirmation flow.
- **Backend (server.ts)**:
    - Added new route `/checkout-family` utilizing `IpaymuClient.createDirectPayment()`.
    - Payload includes name, phone, amount, referenceId.
    - Validates and returns `qris_string`.
- **RPC**: Updated `claim_program_coupon` to handle `attendance_family` & `meal_family`.