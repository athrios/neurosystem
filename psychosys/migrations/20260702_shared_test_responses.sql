-- Links públicos para testes respondidos por paciente, responsável ou informante.
-- Cada link representa uma aplicação independente e nunca grava diretamente um
-- resultado clínico. A correção ocorre após revisão do profissional.

CREATE TABLE IF NOT EXISTS public.test_response_links (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluation_id     UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  psicologo_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  form_code         TEXT NOT NULL REFERENCES public.test_forms(code)
                      ON UPDATE CASCADE ON DELETE RESTRICT,
  share_token       UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  respondent_type   TEXT NOT NULL CHECK (
                      char_length(trim(respondent_type)) BETWEEN 1 AND 40
                    ),
  respondent_name   TEXT NOT NULL CHECK (
                      char_length(trim(respondent_name)) BETWEEN 1 AND 160
                    ),
  relationship      TEXT CHECK (
                      relationship IS NULL OR char_length(relationship) <= 160
                    ),
  status            TEXT NOT NULL DEFAULT 'shared' CHECK (
                      status IN (
                        'shared', 'in_progress', 'submitted',
                        'reviewed', 'revoked', 'expired'
                      )
                    ),
  responses         JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
                      jsonb_typeof(responses) = 'object'
                    ),
  current_step      INTEGER NOT NULL DEFAULT 0 CHECK (current_step >= 0),
  shared_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at      TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Somente formulários com enunciados completos podem ser enviados diretamente.
-- SCARED e SDQ permanecem para transcrição porque a fonte catalogada contém
-- apenas a numeração dos itens e depende do protocolo oficial externo.
UPDATE public.test_forms
SET metadata = metadata || '{"public_response_enabled":true}'::jsonb
WHERE code IN ('SNAP_IV', 'QEDP');

UPDATE public.test_forms
SET metadata = metadata || '{"public_response_enabled":false}'::jsonb
WHERE code IN ('SCARED', 'SDQ_PR');

CREATE OR REPLACE VIEW public.test_catalog_view AS
SELECT
  form.code AS form_code,
  form.name AS form_name,
  form.form_type,
  form.respondent_type,
  form.min_age_months,
  form.max_age_months,
  form.definition_version,
  form.engine_key,
  form.engine_version,
  form.implementation_status,
  form.active,
  form.sort_order,
  form.source_sheet,
  instrument.code AS instrument_code,
  instrument.name AS instrument_name,
  instrument.acronym,
  instrument.description,
  category.code AS category_code,
  category.name AS category_name,
  form.metadata
FROM public.test_forms form
JOIN public.test_instruments instrument ON instrument.code = form.instrument_code
JOIN public.test_categories category ON category.code = instrument.category_code;

GRANT SELECT ON public.test_catalog_view TO authenticated;

ALTER TABLE public.test_response_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_response_links_select" ON public.test_response_links;
CREATE POLICY "test_response_links_select"
  ON public.test_response_links FOR SELECT
  USING (psicologo_id = auth.uid() OR is_master());

DROP POLICY IF EXISTS "test_response_links_update" ON public.test_response_links;
CREATE POLICY "test_response_links_update"
  ON public.test_response_links FOR UPDATE
  USING (psicologo_id = auth.uid() OR is_master())
  WITH CHECK (psicologo_id = auth.uid() OR is_master());

DROP POLICY IF EXISTS "test_response_links_delete" ON public.test_response_links;
CREATE POLICY "test_response_links_delete"
  ON public.test_response_links FOR DELETE
  USING (psicologo_id = auth.uid() OR is_master());

DROP TRIGGER IF EXISTS trg_test_response_links_updated ON public.test_response_links;
CREATE TRIGGER trg_test_response_links_updated
  BEFORE UPDATE ON public.test_response_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_test_response_links_evaluation
  ON public.test_response_links(evaluation_id, form_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_response_links_professional
  ON public.test_response_links(psicologo_id, status);

CREATE OR REPLACE FUNCTION public.create_test_response_link(
  p_evaluation_id UUID,
  p_form_code TEXT,
  p_respondent_type TEXT,
  p_respondent_name TEXT,
  p_relationship TEXT DEFAULT NULL
)
RETURNS SETOF public.test_response_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluation public.evaluations%ROWTYPE;
  v_form public.test_forms%ROWTYPE;
  v_has_respondent_options BOOLEAN;
  v_valid_respondent BOOLEAN;
  v_link public.test_response_links%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  SELECT * INTO v_evaluation
  FROM public.evaluations
  WHERE id = p_evaluation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;
  IF v_evaluation.psicologo_id <> auth.uid() AND NOT public.is_master() THEN
    RAISE EXCEPTION 'Sem permissão para compartilhar esta avaliação.';
  END IF;
  IF v_evaluation.status = 'concluida' THEN
    RAISE EXCEPTION 'A avaliação concluída não pode gerar novos links.';
  END IF;

  SELECT * INTO v_form
  FROM public.test_forms
  WHERE code = p_form_code
    AND active = TRUE
    AND implementation_status IN ('testing', 'active');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formulário indisponível para compartilhamento.';
  END IF;
  IF v_form.respondent_type IN ('professional', 'interview') THEN
    RAISE EXCEPTION 'Este teste requer aplicação pelo profissional.';
  END IF;
  IF NOT COALESCE((v_form.metadata->>'public_response_enabled')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'Este formulário ainda não possui conteúdo público completo.';
  END IF;
  IF NULLIF(trim(p_respondent_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do respondente.';
  END IF;
  IF p_respondent_type NOT IN ('self', 'patient')
     AND NULLIF(trim(p_relationship), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o vínculo do respondente com o paciente.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_form.administration_schema->'sections', '[]')) section,
         jsonb_array_elements(COALESCE(section->'fields', '[]')) field
    WHERE field->>'id' = 'respondent_type'
      AND jsonb_typeof(field->'options') = 'array'
  ) INTO v_has_respondent_options;

  IF v_has_respondent_options THEN
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_form.administration_schema->'sections') section,
           jsonb_array_elements(section->'fields') field,
           jsonb_array_elements(field->'options') option
      WHERE field->>'id' = 'respondent_type'
        AND option->>'value' = p_respondent_type
    ) INTO v_valid_respondent;
  ELSE
    v_valid_respondent := p_respondent_type = v_form.respondent_type;
  END IF;

  IF NOT COALESCE(v_valid_respondent, FALSE) THEN
    RAISE EXCEPTION 'Tipo de respondente incompatível com o formulário.';
  END IF;

  INSERT INTO public.test_response_links (
    evaluation_id,
    patient_id,
    psicologo_id,
    form_code,
    respondent_type,
    respondent_name,
    relationship
  ) VALUES (
    v_evaluation.id,
    v_evaluation.patient_id,
    v_evaluation.psicologo_id,
    v_form.code,
    p_respondent_type,
    trim(p_respondent_name),
    NULLIF(trim(p_relationship), '')
  )
  RETURNING * INTO v_link;

  RETURN NEXT v_link;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shared_test_response(p_token UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', link.id,
    'form_code', link.form_code,
    'form_name', form.name,
    'definition_version', form.definition_version,
    'implementation_status', form.implementation_status,
    'respondent_type', link.respondent_type,
    'respondent_name', link.respondent_name,
    'relationship', link.relationship,
    'status', link.status,
    'responses', link.responses,
    'current_step', link.current_step,
    'patient_name', patient.nome,
    'administration_schema', form.administration_schema
  )
  FROM public.test_response_links link
  JOIN public.test_forms form ON form.code = link.form_code
  JOIN public.patients patient ON patient.id = link.patient_id
  WHERE link.share_token = p_token
    AND link.status IN ('shared', 'in_progress', 'submitted')
    AND (link.expires_at IS NULL OR link.expires_at > NOW())
    AND form.active = TRUE
    AND form.implementation_status IN ('testing', 'active');
$$;

CREATE OR REPLACE FUNCTION public.save_shared_test_response_draft(
  p_token UUID,
  p_responses JSONB,
  p_current_step INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.test_response_links%ROWTYPE;
  v_payload JSONB;
BEGIN
  IF jsonb_typeof(p_responses) <> 'object'
     OR pg_column_size(p_responses) > 1048576 THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_link
  FROM public.test_response_links
  WHERE share_token = p_token
    AND status IN ('shared', 'in_progress')
    AND (expires_at IS NULL OR expires_at > NOW())
  FOR UPDATE;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  v_payload := p_responses || jsonb_build_object(
    'respondent_type', v_link.respondent_type,
    'respondent_name', v_link.respondent_name,
    'relationship', COALESCE(v_link.relationship, '')
  );

  UPDATE public.test_response_links
  SET responses = v_payload,
      current_step = GREATEST(COALESCE(p_current_step, 0), 0),
      status = 'in_progress'
  WHERE id = v_link.id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_shared_test_response(
  p_token UUID,
  p_responses JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.test_response_links%ROWTYPE;
  v_payload JSONB;
BEGIN
  IF jsonb_typeof(p_responses) <> 'object'
     OR pg_column_size(p_responses) > 1048576 THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_link
  FROM public.test_response_links
  WHERE share_token = p_token
    AND status IN ('shared', 'in_progress')
    AND (expires_at IS NULL OR expires_at > NOW())
  FOR UPDATE;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  v_payload := p_responses || jsonb_build_object(
    'respondent_type', v_link.respondent_type,
    'respondent_name', v_link.respondent_name,
    'relationship', COALESCE(v_link.relationship, '')
  );

  UPDATE public.test_response_links
  SET responses = v_payload,
      status = 'submitted',
      responded_at = NOW()
  WHERE id = v_link.id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_test_response_link(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shared_test_response(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_shared_test_response_draft(UUID, JSONB, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_shared_test_response(UUID, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_test_response_link(UUID, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_test_response(UUID)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_shared_test_response_draft(UUID, JSONB, INTEGER)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_shared_test_response(UUID, JSONB)
  TO anon, authenticated;

GRANT SELECT, UPDATE, DELETE ON public.test_response_links TO authenticated;
