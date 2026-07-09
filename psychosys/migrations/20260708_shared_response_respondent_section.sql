--
-- Ajusta o fluxo de avaliações respondidas por não-profissionais:
-- o profissional define tipo/nome do respondente na seção Respondentes e o
-- vínculo passa a ser opcional.

ALTER TABLE public.test_response_links
  ALTER COLUMN respondent_name DROP NOT NULL;

ALTER TABLE public.test_response_links
  DROP CONSTRAINT IF EXISTS test_response_links_respondent_name_check;

ALTER TABLE public.test_response_links
  ADD CONSTRAINT test_response_links_respondent_name_check
  CHECK (
    respondent_name IS NULL
    OR char_length(trim(respondent_name)) BETWEEN 1 AND 160
  );

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
    NULLIF(trim(COALESCE(p_respondent_name, '')), ''),
    NULLIF(trim(p_relationship), '')
  )
  RETURNING * INTO v_link;

  RETURN NEXT v_link;
END;
$$;

REVOKE ALL ON FUNCTION public.create_test_response_link(UUID, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_test_response_link(UUID, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

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
  v_respondent_name TEXT;
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

  v_respondent_name := NULLIF(trim(COALESCE(
    v_link.respondent_name,
    p_responses->>'respondent_name',
    ''
  )), '');

  v_payload := p_responses || jsonb_build_object(
    'respondent_type', v_link.respondent_type,
    'respondent_name', COALESCE(v_respondent_name, ''),
    'relationship', COALESCE(v_link.relationship, '')
  );

  UPDATE public.test_response_links
  SET responses = v_payload,
      respondent_name = COALESCE(v_link.respondent_name, v_respondent_name),
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
  v_respondent_name TEXT;
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

  v_respondent_name := NULLIF(trim(COALESCE(
    v_link.respondent_name,
    p_responses->>'respondent_name',
    ''
  )), '');

  IF v_respondent_name IS NULL THEN
    RETURN FALSE;
  END IF;

  v_payload := p_responses || jsonb_build_object(
    'respondent_type', v_link.respondent_type,
    'respondent_name', v_respondent_name,
    'relationship', COALESCE(v_link.relationship, '')
  );

  UPDATE public.test_response_links
  SET responses = v_payload,
      respondent_name = COALESCE(v_link.respondent_name, v_respondent_name),
      status = 'submitted',
      responded_at = NOW()
  WHERE id = v_link.id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.save_shared_test_response_draft(UUID, JSONB, INTEGER)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_shared_test_response(UUID, JSONB)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_shared_test_response_draft(UUID, JSONB, INTEGER)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_shared_test_response(UUID, JSONB)
  TO anon, authenticated;
