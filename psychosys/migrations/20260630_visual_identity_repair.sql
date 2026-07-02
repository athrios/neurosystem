ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_data TEXT,
  ADD COLUMN IF NOT EXISTS logo_alignment TEXT NOT NULL DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS footer_line1 TEXT,
  ADD COLUMN IF NOT EXISTS footer_line2 TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_logo_alignment_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_logo_alignment_check
  CHECK (logo_alignment IN ('left', 'center', 'right'));

DROP FUNCTION IF EXISTS public.get_shared_anamnesis(UUID);

CREATE FUNCTION public.get_shared_anamnesis(p_token UUID)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  patient_nome TEXT,
  questions JSONB,
  responses JSONB,
  current_step INTEGER,
  status TEXT,
  logo_data TEXT,
  logo_alignment TEXT,
  footer_line1 TEXT,
  footer_line2 TEXT
) AS $$
  SELECT
    a.id,
    a.nome,
    p.nome,
    a.questions,
    a.responses,
    a.current_step,
    a.status,
    pr.logo_data,
    pr.logo_alignment,
    pr.footer_line1,
    pr.footer_line2
  FROM public.anamneses a
  JOIN public.patients p ON p.id = a.patient_id
  JOIN public.profiles pr ON pr.id = a.psicologo_id
  WHERE a.share_token = p_token
    AND a.status IN ('compartilhada', 'respondida');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.get_shared_anamnesis(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_anamnesis(UUID) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('logo_data', 'logo_alignment', 'footer_line1', 'footer_line2')
ORDER BY column_name;
