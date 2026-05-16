# Template Email untuk Supabase Dashboard

## Cara Penggunaan
1. Buka **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Pilih tab yang sesuai
3. Paste template di bawah
4. Simpan

---

## 1. CONFIRM SIGNUP (Verifikasi Email)

```html
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6;">
<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

  <!-- Header - Logo Saja -->
  <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 40px 40px; text-align: center;">
    <img
      src="https://jofwebrbdlovwkgklwab.supabase.co/storage/v1/object/public/Logo/logo-landscape.png"
      alt="SPS Corner"
      style="height: 80px; display: block; margin-left: auto; margin-right: auto;"
    >
  </div>

  <!-- Content -->
  <div style="padding: 40px;">
    <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 22px; font-weight: bold;">Verifikasi Email Anda</h2>

    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
      Halo,
    </p>

    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
      Terima kasih telah mendaftar di <strong style="color: #1e40af;">SPS Corner</strong>. Untuk mengaktifkan akun Anda, silakan klik tombol di bawah:
    </p>

    <!-- Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #1e40af, #3b82f6); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(29, 78, 216, 0.4);">
        Verifikasi Email
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
      Atau salin tautan berikut ke browser Anda:<br>
      <span style="color: #3b82f6; word-break: break-all; font-size: 12px;">{{ .ConfirmationURL }}</span>
    </p>

    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-top: 24px;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        ⏱️ <strong>Catatan:</strong> Tautan ini berlaku selama 24 jam. Jika Anda tidak mendaftar di SPS Corner, abaikan email ini.
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center;">
    <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">Email ini dikirim secara otomatis oleh sistem SPS Corner</p>
    <p style="margin: 0; font-size: 12px; color: #9ca3af;">Koperasi Karyawan SPS — Banjarmasin | <a href="https://spscorner.store" style="color: #3b82f6; text-decoration: none;">spscorner.store</a></p>
  </div>
</div>
</body>
```

---

## 2. RESET PASSWORD

```html
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6;">
<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

  <!-- Header - Logo Saja -->
  <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 40px 40px; text-align: center;">
    <img
      src="https://jofwebrbdlovwkgklwab.supabase.co/storage/v1/object/public/Logo/logo-landscape.png"
      alt="SPS Corner"
      style="height: 80px; display: block; margin-left: auto; margin-right: auto;"
    >
  </div>

  <!-- Content -->
  <div style="padding: 40px;">
    <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 22px; font-weight: bold;">Reset Password Anda</h2>

    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
      Halo,
    </p>

    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
      Kami menerima permintaan untuk mereset password akun <strong style="color: #1e40af;">SPS Corner</strong> Anda. Klik tombol di bawah untuk membuat password baru:
    </p>

    <!-- Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #1e40af, #3b82f6); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(29, 78, 216, 0.4);">
        Reset Password
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
      Atau salin tautan berikut ke browser Anda:<br>
      <span style="color: #3b82f6; word-break: break-all; font-size: 12px;">{{ .ConfirmationURL }}</span>
    </p>

    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-top: 24px;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        ⚠️ <strong>Peringatan:</strong> Tautan ini hanya berlaku selama 1 jam. Jika Anda tidak meminta reset password, abaikan email ini dan akun Anda tetap aman.
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center;">
    <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">Email ini dikirim secara otomatis oleh sistem SPS Corner</p>
    <p style="margin: 0; font-size: 12px; color: #9ca3af;">Koperasi Karyawan SPS — Banjarmasin | <a href="https://spscorner.store" style="color: #3b82f6; text-decoration: none;">spscorner.store</a></p>
  </div>
</div>
</body>
```

---

## 3. INVITE USER (Undangan)

```html
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6;">
<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

  <!-- Header - Logo Saja -->
  <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 40px 40px; text-align: center;">
    <img
      src="https://jofwebrbdlovwkgklwab.supabase.co/storage/v1/object/public/Logo/logo-landscape.png"
      alt="SPS Corner"
      style="height: 80px; display: block; margin-left: auto; margin-right: auto;"
    >
  </div>

  <!-- Content -->
  <div style="padding: 40px;">
    <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 22px; font-weight: bold;">Anda Diundang untuk Bergabung! 🎉</h2>

    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
      Halo,
    </p>

    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
      Anda telah diundang untuk bergabung dengan <strong style="color: #1e40af;">SPS Corner</strong> - Platform e-commerce Koperasi Karyawan SPS Banjarmasin.
    </p>

    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 12px 0; color: #0369a1; font-size: 14px; font-weight: bold;">✨ Keunggulan SPS Corner:</p>
      <ul style="margin: 0; padding-left: 20px; color: #075985; font-size: 14px; line-height: 1.8;">
        <li>Beli produk kantin dan kopi dengan mudah</li>
        <li>Ikuti program serikat pekerja</li>
        <li>Dapatkan poin loyalty setiap belanja</li>
        <li>Akses portal serikat pekerja</li>
      </ul>
    </div>

    <!-- Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #1e40af, #3b82f6); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(29, 78, 216, 0.4);">
        Daftar Sekarang
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
      Tautan undangan ini berlaku selama <strong>7 hari</strong>.
    </p>
  </div>

  <!-- Footer -->
  <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center;">
    <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">Email ini dikirim secara otomatis oleh sistem SPS Corner</p>
    <p style="margin: 0; font-size: 12px; color: #9ca3af;">Koperasi Karyawan SPS — Banjarmasin | <a href="https://spscorner.store" style="color: #3b82f6; text-decoration: none;">spscorner.store</a></p>
  </div>
</div>
</body>
```

---

## 4. EMAIL CHANGE (Konfirmasi Pergantian Email)

```html
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6;">
<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

  <!-- Header - Logo Saja -->
  <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 40px 40px; text-align: center;">
    <img
      src="https://jofwebrbdlovwkgklwab.supabase.co/storage/v1/object/public/Logo/logo-landscape.png"
      alt="SPS Corner"
      style="height: 80px; display: block; margin-left: auto; margin-right: auto;"
    >
  </div>

  <!-- Content -->
  <div style="padding: 40px;">
    <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 22px; font-weight: bold;">Konfirmasi Perubahan Email</h2>

    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
      Halo,
    </p>

    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
      Kami menerima permintaan untuk mengubah email akun <strong style="color: #1e40af;">SPS Corner</strong> Anda ke alamat baru. Klik tombol di bawah untuk mengonfirmasi perubahan ini:
    </p>

    <!-- Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #1e40af, #3b82f6); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(29, 78, 216, 0.4);">
        Konfirmasi Email Baru
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
      Atau salin tautan berikut ke browser Anda:<br>
      <span style="color: #3b82f6; word-break: break-all; font-size: 12px;">{{ .ConfirmationURL }}</span>
    </p>

    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-top: 24px;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        ⚠️ <strong>Peringatan:</strong> Tautan ini hanya berlaku selama 1 jam. Jika Anda tidak meminta perubahan email, abaikan email ini dan email Anda akan tetap seperti semula.
      </p>
    </div>

    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 24px;">
      Email baru Anda akan aktif setelah konfirmasi ini berhasil dilakukan.
    </p>
  </div>

  <!-- Footer -->
  <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center;">
    <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">Email ini dikirim secara otomatis oleh sistem SPS Corner</p>
    <p style="margin: 0; font-size: 12px; color: #9ca3af;">Koperasi Karyawan SPS — Banjarmasin | <a href="https://spscorner.store" style="color: #3b82f6; text-decoration: none;">spscorner.store</a></p>
  </div>
</div>
</body>
```

---

## Perubahan yang Dilakukan

| Perubahan | Sebelum | Sesudah |
|------------|---------|---------|
| Ukuran Logo | `height: 50px` | `height: 80px` |
| Tulisan Header | Ada "SPS Corner" + tagline | Dihilangkan, hanya logo |
| Padding Header | `30px 40px` | `40px 40px` (lebih besar) |

---

## Cara Pasang

1. **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Pilih tab → Paste template → **Save Template**
3. Ulangi untuk 4 tab:
   - **Confirm signup** → Template #1
   - **Reset password** → Template #2
   - **Invite user** → Template #3
   - **Email change** → Template #4

---

**File ini disimpan: EMAIL_TEMPLATES_SUPABASE.md**