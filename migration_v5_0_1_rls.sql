-- Migration v5.0.1
-- Fix RLS policy for announcement_survey_responses (INSERT blocked for authenticated users)
-- Switch AI provider from Gemini to Groq (GROQ_API_KEY replaces GEMINI_API_KEY)

-- ==========================================
-- 1. RLS: announcement_survey_responses
-- ==========================================
alter table if exists public.announcement_survey_responses enable row level security;

drop policy if exists "Users can insert own survey responses" on public.announcement_survey_responses;
drop policy if exists "Users can view own survey responses" on public.announcement_survey_responses;
drop policy if exists "Admins can view all survey responses" on public.announcement_survey_responses;

create policy "Users can insert own survey responses"
  on public.announcement_survey_responses
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can view own survey responses"
  on public.announcement_survey_responses
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can view all survey responses"
  on public.announcement_survey_responses
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'superadmin')
    )
  );

-- ==========================================
-- 2. Update env variable name guidance
-- ==========================================
-- Replace GEMINI_API_KEY with GROQ_API_KEY in .env
-- New key: <your-groq-api-key>
-- Groq model: llama-3.2-11b-vision-preview (for receipt verification)
