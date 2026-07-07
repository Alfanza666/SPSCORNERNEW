-- ============================================
-- Migration 003: Announcement Department Target
-- Version: v5.3.0
-- Deskripsi: Tambah kolom target_departments di tabel announcements
-- untuk filtering pengumuman berdasarkan departemen
-- ============================================

ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS target_departments text[] DEFAULT '{}';
