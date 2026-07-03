-- Exclusão controlada de testes aplicados.
-- Nesta fase a exclusão usa confirmação explícita. A estrutura de senha
-- individual fica preparada, mas a senha ainda não é cadastrada nem validada.

CREATE TABLE IF NOT EXISTS public.professional_security_settings (
  profile_id                     UUID PRIMARY KEY
                                 REFERENCES public.profiles(id) ON DELETE CASCADE,
  test_deletion_password_hash    TEXT,
  test_deletion_password_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  password_version               INTEGER NOT NULL DEFAULT 0
                                 CHECK (password_version >= 0),
  failed_attempts                INTEGER NOT NULL DEFAULT 0
                                 CHECK (failed_attempts >= 0),
  locked_until                   TIMESTAMPTZ,
  password_updated_at            TIMESTAMPTZ,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    test_deletion_password_enabled = FALSE
    OR test_deletion_password_hash IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.test_deletion_audit (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluation_id          UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  test_result_id          UUID NOT NULL,
  form_code               TEXT NOT NULL,
  professional_owner_id   UUID NOT NULL REFERENCES public.profiles(id),
  deleted_by              UUID NOT NULL REFERENCES public.profiles(id),
  authorization_method    TEXT NOT NULL DEFAULT 'explicit_confirmation'
                          CHECK (authorization_method IN (
                            'explicit_confirmation',
                            'professional_password',
                            'master_override'
                          )),
  result_status           TEXT,
  result_version          INTEGER,
  response_links_revoked  INTEGER NOT NULL DEFAULT 0,
  deleted_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.professional_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_deletion_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professional_security_settings_select"
  ON public.professional_security_settings;
CREATE POLICY "professional_security_settings_select"
  ON public.professional_security_settings FOR SELECT
  USING (profile_id = auth.uid() OR is_master());

DROP POLICY IF EXISTS "professional_security_settings_insert"
  ON public.professional_security_settings;
CREATE POLICY "professional_security_settings_insert"
  ON public.professional_security_settings FOR INSERT
  WITH CHECK (profile_id = auth.uid() OR is_master());

DROP POLICY IF EXISTS "professional_security_settings_update"
  ON public.professional_security_settings;
CREATE POLICY "professional_security_settings_update"
  ON public.professional_security_settings FOR UPDATE
  USING (profile_id = auth.uid() OR is_master())
  WITH CHECK (profile_id = auth.uid() OR is_master());

DROP POLICY IF EXISTS "test_deletion_audit_select"
  ON public.test_deletion_audit;
CREATE POLICY "test_deletion_audit_select"
  ON public.test_deletion_audit FOR SELECT
  USING (professional_owner_id = auth.uid() OR is_master());

DROP TRIGGER IF EXISTS trg_professional_security_settings_updated
  ON public.professional_security_settings;
CREATE TRIGGER trg_professional_security_settings_updated
  BEFORE UPDATE ON public.professional_security_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_test_deletion_audit_evaluation
  ON public.test_deletion_audit(evaluation_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_deletion_audit_owner
  ON public.test_deletion_audit(professional_owner_id, deleted_at DESC);

CREATE OR REPLACE FUNCTION public.delete_applied_test(
  p_evaluation_id UUID,
  p_form_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluation public.evaluations%ROWTYPE;
  v_result public.test_results%ROWTYPE;
  v_password_enabled BOOLEAN := FALSE;
  v_revoked_count INTEGER := 0;
  v_authorization_method TEXT := 'explicit_confirmation';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  SELECT * INTO v_evaluation
  FROM public.evaluations
  WHERE id = p_evaluation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;
  IF v_evaluation.psicologo_id <> auth.uid() AND NOT public.is_master() THEN
    RAISE EXCEPTION 'Sem permissão para excluir este teste.';
  END IF;
  IF v_evaluation.status = 'concluida' THEN
    RAISE EXCEPTION 'Reabra a avaliação antes de excluir um teste aplicado.';
  END IF;

  SELECT COALESCE(test_deletion_password_enabled, FALSE)
  INTO v_password_enabled
  FROM public.professional_security_settings
  WHERE profile_id = v_evaluation.psicologo_id;

  -- Bloqueio preventivo: quando a senha for habilitada, esta função só poderá
  -- continuar após a implementação da validação criptográfica.
  IF COALESCE(v_password_enabled, FALSE) THEN
    RAISE EXCEPTION 'A validação da senha de exclusão ainda não foi implementada.';
  END IF;

  SELECT * INTO v_result
  FROM public.test_results
  WHERE evaluation_id = p_evaluation_id
    AND test_code = p_form_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resultado do teste não encontrado.';
  END IF;

  IF public.is_master() AND v_evaluation.psicologo_id <> auth.uid() THEN
    v_authorization_method := 'master_override';
  END IF;

  UPDATE public.test_response_links
  SET status = 'revoked'
  WHERE evaluation_id = p_evaluation_id
    AND form_code = p_form_code
    AND status <> 'revoked';
  GET DIAGNOSTICS v_revoked_count = ROW_COUNT;

  INSERT INTO public.test_deletion_audit (
    evaluation_id,
    test_result_id,
    form_code,
    professional_owner_id,
    deleted_by,
    authorization_method,
    result_status,
    result_version,
    response_links_revoked
  ) VALUES (
    v_evaluation.id,
    v_result.id,
    p_form_code,
    v_evaluation.psicologo_id,
    auth.uid(),
    v_authorization_method,
    v_result.result_status,
    v_result.result_version,
    v_revoked_count
  );

  DELETE FROM public.test_results
  WHERE id = v_result.id;

  RETURN jsonb_build_object(
    'deleted', TRUE,
    'form_code', p_form_code,
    'response_links_revoked', v_revoked_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_applied_test(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_applied_test(UUID, TEXT) TO authenticated;

GRANT SELECT, INSERT, UPDATE
  ON public.professional_security_settings TO authenticated;
GRANT SELECT ON public.test_deletion_audit TO authenticated;

