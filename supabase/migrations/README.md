# Supabase Migrations

Gunakan [Supabase CLI](https://supabase.com/docs/guides/cli) untuk mengelola migrasi database.

## Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Login ke akun Supabase
supabase login

# Init project (pertama kali)
supabase init

# Link ke project Supabase yang sudah ada
supabase link --project-ref <PROJECT_REF>
```

## Membuat Migrasi Baru

```bash
supabase migration new nama_migrasi
```

## Menerapkan Migrasi

```bash
supabase db push
```

## Melihat Status

```bash
supabase migration list
```

## Catatan

- Semua perubahan schema database harus melalui migration, jangan edit langsung di Supabase Dashboard.
- Migration bersifat idempotent — aman dijalankan berulang.
- File migration di-commit ke git untuk traceability.
