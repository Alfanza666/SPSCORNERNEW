# 📘 PANDUAN PENGGUNAAN PORTAL SERIKAT PEKERJA - SPS CORNER

---

## 1. AKSES PORTAL

### 1.1 Cara Mengakses Portal

**Langkah-langkah:**
1. Login ke SPS Corner dengan NIK atau Google
2. Jika role Anda adalah **buyer**, **seller**, atau **admin**:
   - Otomatis bisa akses portal
3. Di sidebar, klik menu **"Portal Serikat"** atau **"Portal"**
4. Atau akses langsung: `/portal`

### 1.2 Menu-Menu yang Tersedia

| Menu | URL | Deskripsi |
|------|-----|-----------|
| Dashboard | /portal | Halaman utama portal |
| Pengaduan & Pembelaan | /portal/pengaduan | Sampaikan masalah dengan aman |
| Pengumuman Serikat | /portal/pengumuman | Info terbaru dari manajemen |
| Program Serikat | /portal/program | Program serikat (kupon, kurban, dll) |
| Kritik & Saran | /portal/kritik | Masukan untuk meeting bipartit |
| Formulir | /portal/forms | Daftar formulir yang tersedia |
| Flashsale | /portal/flashsale | Lihat dan ikut lelang |
| Profil | /portal/profile | Data diri dan pengaturan |

---

## 2. DASHBOARD PORTAL

**URL:** `/portal`

### Cara Menggunakan

**Langkah-langkah:**
1. Buka `/portal`
2. Di bagian **Welcome Banner**, lihat:
   - Logo Federasi
   - Nama Anda
   - Pesan selamat datang
3. Di bagian **Stats Cards**, lihat informasi:
   - **Anggota** → Jumlah anggota terverifikasi (memiliki NIK)
   - **Program** → Jumlah program aktif saat ini
   - **Informasi** → Jumlah pengumuman
4. Di bagian **Menu Utama**, klik quick access card untuk langsung ke menu yang diinginkan

---

## 3. PENGADUAN & PEMBELAAN

**URL:** `/portal/pengaduan`

### Cara Mengajukan Pengaduan

**Langkah-langkah:**
1. Buka `/portal/pengaduan`
2. Klik tombol **"Ajukan Pengaduan"**
3. Isi formulir pengaduan:
   - **Kategori Pengaduan** (pilih dari dropdown)
   - **Judul** (ringkas mengenai masalah)
   - **Deskripsi** (detail lengkap masalah yang ingin dilaporkan)
   - **Lampiran** (opsional, bisa upload bukti/dokumen)
4. Klik tombol **"Kirim"**
5. Notifikasi: "Pengaduan berhasil dikirim"
6. Data dijamin rahasia dan akan ditindaklanjuti oleh admin serikat

### Tips
- Jelaskan kronologi dengan jelas
- Upload bukti jika ada
- Data Anda akan dijamin kerahasiaannya

---

## 4. PENGUMUMAN SERIKAT

**URL:** `/portal/pengumuman`

### Cara Membaca Pengumuman

**Langkah-langkah:**
1. Buka `/portal/pengumuman`
2. Daftar pengumuman akan ditampilkan
3. Filter jika diperlukan (semua/berdasarkan tanggal)
4. Klik pada pengumuman untuk membaca detail lengkap
5. Baca informasi lengkap termasuk tanggal dan prioritas

---

## 5. PROGRAM SERIKAT

**URL:** `/portal/program`

### Cara Mengikuti Program

**Langkah-langkah:**
1. Buka `/portal/program`
2. Daftar program yang tersedia akan ditampilkan:
   - **Kupon** → Program kupon pembelian
   - **Kurban** → Program kurban qurban
   - **Gathering** → Acara pertemuan anggota
   - **Lainnya** → Program lainnya
3. Klik pada program yang diinginkan
4. Jika program memerlukan formulir:
   - Isi data yang diminta di formulir
   - Klik **"Submit"** atau **"Daftar"**
5. Tunggu konfirmasi dari admin
6. Jika berhasil, akan ada notifikasi

### Tips
- Pilih program yang sesuai dengan kebutuhan
- Isi data dengan benar dan lengkap

---

## 6. KRITIK & SARAN

**URL:** `/portal/kritik`

### Cara Mengirim Kritik/Saran

**Langkah-langkah:**
1. Buka `/portal/kritik`
2. Klik tombol **"Kirim Kritik/Saran"**
3. Isi formulir:
   - **Topik** (judul singkat)
   - **Kritik/Saran** (detail kritik atau saran Anda)
   - **Saran Perbaikan** (opsional, solusi yang Anda usulkan)
4. Klik tombol **"Kirim"**
5. Notifikasi: "Kritik/Saran berhasil dikirim"
6. Masukan akan digunakan untuk meeting bipartit dengan manajemen

### Tips
- Sampaikan secara konstruktif
- Berikan solusi jika memungkinkan
- Fokus pada perbaikan lingkungan kerja

---

## 7. FORMULIR

**URL:** `/portal/forms`

### 7.1 Melihat Daftar Formulir

**Langkah-langkah:**
1. Buka `/portal/forms`
2. Daftar formulir yang tersedia akan ditampilkan
3. Setiap formulir menunjukkan:
   - Judul
   - Deskripsi
   - Jumlah response

### 7.2 Mengisi Formulir

**Langkah-langkah:**
1. Klik pada formulir yang ingin diisi
2. Halaman form akan menampilkan field-field yang perlu diisi
3. Isi data sesuai dengan field yang tersedia:
   - Text → Masukkan teks
   - Textarea → Masukkan teks panjang
   - Number → Masukkan angka
   - Date → Pilih tanggal
   - Select → Pilih salah satu opsi
   - Checkbox → Centang opsi yang sesuai
4. Field yang bertanda **required** wajib diisi
5. Klik tombol **"Submit"** atau **"Kirim"**
6. Notifikasi: "Formulir berhasil disubmit"

### 7.3 Melihat Status Submission

**Langkah-langkah:**
1. Di halaman form `/portal/forms/:formId`
2. Lihat **history submission** jika sudah pernah submit
3. Jika sudah submit, status akan ditampilkan

---

## 8. FLASHSALE / LELANG

**URL:** `/portal/flashsale`

### 8.1 Melihat Aset yang Dilelang

**Langkah-langkah:**
1. Buka `/portal/flashsale`
2. Daftar aset yang tersedia untuk dilelang akan ditampilkan
3. Setiap aset menunjukkan:
   - Judul
   - Deskripsi
   - Harga taksiran
   - Status (open/sold)
   - Gambar

### 8.2 Mengikuti Lelang

**Langkah-langkah:**
1. Klik pada aset yang ingin diikuti
2. Lihat detail aset:
   - Judul, deskripsi, harga taksiran
   - Status lelang
3. Jika status **"open"**:
   - Klik tombol **"Ikuti Lelang"** atau **"Booking"**
4. Sistem akan menyimpan booking Anda
5. Tunggu hasil lelang dari admin
6. Jika menang → Status **"won"**
7. Jika tidak menang → Status **"lost"**

### Tips
- Pastikan harga taksiran sesuai dengan budget
- Ikuti jadwal lelang yang ditentukan

---

## 9. PROFIL

**URL:** `/portal/profile`

### 9.1 Melihat Profil

**Langkah-langkah:**
1. Buka `/portal/profile`
2. Data diri yang ditampilkan:
   - **Nama** → Nama lengkap
   - **NIK** → Nomor Induk Karyawan
   - **Email** → Email terdaftar
   - **No HP** → Nomor HP
   - **Role** → Peran di sistem (buyer/seller/admin)
   - **Points** → Loyalty points (jika ada)

### 9.2 Mengedit Profil

**Langkah-langkah:**
1. Di halaman profil, klik tombol **"Edit Profil"** atau **"Ubah"**
2. Formulir edit akan muncul
3. Ubah data yang diperlukan:
   - Nama Lengkap
   - Email
   - Nomor HP
   - Password (jika ingin ganti)
4. Klik tombol **"Simpan"** atau **"Update"**
5. Notifikasi: "Profil berhasil diperbarui"

---

## CATATAN PENTING

- Portal dapat diakses oleh **buyer**, **seller**, dan **admin**
- Data pengaduan dijamin kerahasiaannya
- Kritik dan saran akan digunakan untuk meeting bipartit
- Ikuti program serikat yang tersedia untuk kepentingan Anda