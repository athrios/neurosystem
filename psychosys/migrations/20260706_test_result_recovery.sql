-- Lluria - exclusão e restauração autenticadas de testes aplicados.
--
-- IMPORTANTE: a senha 1234 existe somente para o ambiente de teste.
-- Ela é persistida como hash bcrypt e deve ser substituída antes da produção.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.test_response_links
  ADD COLUMN IF NOT EXISTS calculation_count INTEGER NOT NULL DEFAULT 0
    CHECK (calculation_count BETWEEN 0 AND 3);

ALTER TABLE public.test_deletion_audit
  ADD COLUMN IF NOT EXISTS result_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS snapshot_saved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS response_link_id UUID,
  ADD COLUMN IF NOT EXISTS response_link_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS restored_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restoration_method TEXT
    CHECK (restoration_method IS NULL OR restoration_method = 'professional_password');

CREATE INDEX IF NOT EXISTS idx_test_deletion_audit_recovery
  ON public.test_deletion_audit(evaluation_id, restored_at, deleted_at DESC);

-- Habilita a senha temporária para perfis já existentes sem sobrescrever
-- uma senha que tenha sido configurada anteriormente.
INSERT INTO public.professional_security_settings (
  profile_id,
  test_deletion_password_hash,
  test_deletion_password_enabled,
  password_version,
  password_updated_at
)
SELECT
  profile.id,
  crypt('1234', gen_salt('bf')),
  TRUE,
  1,
  NOW()
FROM public.profiles profile
ON CONFLICT (profile_id) DO UPDATE
SET
  test_deletion_password_hash = COALESCE(
    public.professional_security_settings.test_deletion_password_hash,
    EXCLUDED.test_deletion_password_hash
  ),
  test_deletion_password_enabled = TRUE,
  password_version = CASE
    WHEN public.professional_security_settings.test_deletion_password_hash IS NULL
      THEN 1
    ELSE public.professional_security_settings.password_version
  END,
  password_updated_at = COALESCE(
    public.professional_security_settings.password_updated_at,
    NOW()
  ),
  updated_at = NOW();

-- Perfis criados enquanto esta configuração de teste estiver ativa também
-- recebem a senha temporária. Remover este gatilho junto com a senha padrão.
CREATE OR REPLACE FUNCTION public.initialize_test_management_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.professional_security_settings (
    profile_id,
    test_deletion_password_hash,
    test_deletion_password_enabled,
    password_version,
    password_updated_at
  ) VALUES (
    NEW.id,
    crypt('1234', gen_salt('bf')),
    TRUE,
    1,
    NOW()
  )
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_test_management_password
  ON public.profiles;
CREATE TRIGGER trg_profiles_test_management_password
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.initialize_test_management_password();

-- Remove a assinatura antiga para que a exclusão sem senha não possa ser
-- chamada por clientes desatualizados.
DROP FUNCTION IF EXISTS public.delete_applied_test(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.delete_applied_test(
  p_evaluation_id UUID,
  p_form_code TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_evaluation public.evaluations%ROWTYPE;
  v_result public.test_results%ROWTYPE;
  v_response_link public.test_response_links%ROWTYPE;
  v_response_link_id UUID;
  v_settings public.professional_security_settings%ROWTYPE;
  v_failed_attempts INTEGER;
  v_original_status TEXT;
  v_revoked_count INTEGER := 0;
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
  v_original_status := v_evaluation.status;

  SELECT * INTO v_settings
  FROM public.professional_security_settings
  WHERE profile_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND
    OR NOT COALESCE(v_settings.test_deletion_password_enabled, FALSE)
    OR v_settings.test_deletion_password_hash IS NULL
  THEN
    RETURN jsonb_build_object(
      'deleted', FALSE,
      'code', 'password_not_configured',
      'message', 'A senha de segurança do profissional não está configurada.'
    );
  END IF;

  IF v_settings.locked_until IS NOT NULL AND v_settings.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'deleted', FALSE,
      'code', 'password_locked',
      'message', 'Muitas tentativas incorretas. Tente novamente em 15 minutos.'
    );
  END IF;

  IF p_password IS NULL
    OR crypt(p_password, v_settings.test_deletion_password_hash)
      <> v_settings.test_deletion_password_hash
  THEN
    v_failed_attempts := COALESCE(v_settings.failed_attempts, 0) + 1;
    UPDATE public.professional_security_settings
    SET
      failed_attempts = CASE WHEN v_failed_attempts >= 5 THEN 0 ELSE v_failed_attempts END,
      locked_until = CASE WHEN v_failed_attempts >= 5
        THEN NOW() + INTERVAL '15 minutes'
        ELSE NULL
      END
    WHERE profile_id = auth.uid();

    RETURN jsonb_build_object(
      'deleted', FALSE,
      'code', CASE WHEN v_failed_attempts >= 5
        THEN 'password_locked'
        ELSE 'invalid_password'
      END,
      'message', CASE WHEN v_failed_attempts >= 5
        THEN 'Muitas tentativas incorretas. Acesso bloqueado por 15 minutos.'
        ELSE 'Senha incorreta.'
      END,
      'attempts_remaining', GREATEST(5 - v_failed_attempts, 0)
    );
  END IF;

  UPDATE public.professional_security_settings
  SET failed_attempts = 0, locked_until = NULL
  WHERE profile_id = auth.uid();

  SELECT * INTO v_result
  FROM public.test_results
  WHERE evaluation_id = p_evaluation_id
    AND test_code = p_form_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resultado do teste não encontrado.';
  END IF;

  IF v_result.meta ? 'response_link_id' THEN
    BEGIN
      v_response_link_id := (v_result.meta->>'response_link_id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      v_response_link_id := NULL;
    END;
  END IF;

  IF v_response_link_id IS NOT NULL THEN
    SELECT * INTO v_response_link
    FROM public.test_response_links
    WHERE id = v_response_link_id
      AND evaluation_id = p_evaluation_id
      AND form_code = p_form_code
    FOR UPDATE;
  END IF;

  -- Alguns ambientes possuem trigger/policy que bloqueia alterações em
  -- test_results quando a avaliação está concluída. A exclusão autenticada por
  -- senha é uma exceção controlada: reabrimos somente dentro desta transação e
  -- restauramos o status original antes de retornar.
  IF v_original_status = 'concluida' THEN
    PERFORM set_config('app.test_result_recovery_authorized', 'on', TRUE);

    UPDATE public.evaluations
    SET status = 'em_andamento'
    WHERE id = v_evaluation.id;
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
    response_links_revoked,
    result_snapshot,
    snapshot_saved,
    response_link_id,
    response_link_snapshot
  ) VALUES (
    v_evaluation.id,
    v_result.id,
    p_form_code,
    v_evaluation.psicologo_id,
    auth.uid(),
    'professional_password',
    v_result.result_status,
    v_result.result_version,
    v_revoked_count,
    to_jsonb(v_result),
    TRUE,
    CASE WHEN v_response_link.id IS NULL THEN NULL ELSE v_response_link.id END,
    CASE WHEN v_response_link.id IS NULL THEN NULL ELSE to_jsonb(v_response_link) END
  );

  IF v_response_link.id IS NOT NULL THEN
    PERFORM set_config('app.test_response_deletion_authorized', 'on', TRUE);

    DELETE FROM public.test_response_links
    WHERE id = v_response_link.id;
  END IF;

  PERFORM set_config('app.test_response_deletion_authorized', 'on', TRUE);

  DELETE FROM public.test_results
  WHERE id = v_result.id;

  IF v_original_status = 'concluida' THEN
    UPDATE public.evaluations
    SET status = 'concluida'
    WHERE id = v_evaluation.id;
  END IF;

  RETURN jsonb_build_object(
    'deleted', TRUE,
    'form_code', p_form_code,
    'response_links_revoked', v_revoked_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_applied_test(
  p_deletion_id UUID,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_audit public.test_deletion_audit%ROWTYPE;
  v_evaluation public.evaluations%ROWTYPE;
  v_settings public.professional_security_settings%ROWTYPE;
  v_result public.test_results%ROWTYPE;
  v_response_link public.test_response_links%ROWTYPE;
  v_failed_attempts INTEGER;
  v_original_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  SELECT * INTO v_audit
  FROM public.test_deletion_audit
  WHERE id = p_deletion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de exclusão não encontrado.';
  END IF;

  SELECT * INTO v_evaluation
  FROM public.evaluations
  WHERE id = v_audit.evaluation_id
  FOR UPDATE;

  IF v_evaluation.psicologo_id <> auth.uid() AND NOT public.is_master() THEN
    RAISE EXCEPTION 'Sem permissão para restaurar este teste.';
  END IF;
  v_original_status := v_evaluation.status;

  IF v_audit.restored_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'restored', FALSE,
      'code', 'already_restored',
      'message', 'Este resultado já foi restaurado.'
    );
  END IF;
  IF NOT v_audit.snapshot_saved OR v_audit.result_snapshot IS NULL THEN
    RETURN jsonb_build_object(
      'restored', FALSE,
      'code', 'snapshot_unavailable',
      'message', 'Este registro antigo não possui dados suficientes para restauração.'
    );
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.test_results
    WHERE evaluation_id = v_audit.evaluation_id
      AND test_code = v_audit.form_code
  ) THEN
    RETURN jsonb_build_object(
      'restored', FALSE,
      'code', 'result_conflict',
      'message', 'Já existe um resultado deste teste na avaliação.'
    );
  END IF;

  SELECT * INTO v_settings
  FROM public.professional_security_settings
  WHERE profile_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND
    OR NOT COALESCE(v_settings.test_deletion_password_enabled, FALSE)
    OR v_settings.test_deletion_password_hash IS NULL
  THEN
    RETURN jsonb_build_object(
      'restored', FALSE,
      'code', 'password_not_configured',
      'message', 'A senha de segurança do profissional não está configurada.'
    );
  END IF;

  IF v_settings.locked_until IS NOT NULL AND v_settings.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'restored', FALSE,
      'code', 'password_locked',
      'message', 'Muitas tentativas incorretas. Tente novamente em 15 minutos.'
    );
  END IF;

  IF p_password IS NULL
    OR crypt(p_password, v_settings.test_deletion_password_hash)
      <> v_settings.test_deletion_password_hash
  THEN
    v_failed_attempts := COALESCE(v_settings.failed_attempts, 0) + 1;
    UPDATE public.professional_security_settings
    SET
      failed_attempts = CASE WHEN v_failed_attempts >= 5 THEN 0 ELSE v_failed_attempts END,
      locked_until = CASE WHEN v_failed_attempts >= 5
        THEN NOW() + INTERVAL '15 minutes'
        ELSE NULL
      END
    WHERE profile_id = auth.uid();

    RETURN jsonb_build_object(
      'restored', FALSE,
      'code', CASE WHEN v_failed_attempts >= 5
        THEN 'password_locked'
        ELSE 'invalid_password'
      END,
      'message', CASE WHEN v_failed_attempts >= 5
        THEN 'Muitas tentativas incorretas. Acesso bloqueado por 15 minutos.'
        ELSE 'Senha incorreta.'
      END,
      'attempts_remaining', GREATEST(5 - v_failed_attempts, 0)
    );
  END IF;

  UPDATE public.professional_security_settings
  SET failed_attempts = 0, locked_until = NULL
  WHERE profile_id = auth.uid();

  v_result := jsonb_populate_record(
    NULL::public.test_results,
    v_audit.result_snapshot
  );
  IF v_audit.response_link_snapshot IS NOT NULL THEN
    v_response_link := jsonb_populate_record(
      NULL::public.test_response_links,
      v_audit.response_link_snapshot
    );
  END IF;

  -- Mesma exceção controlada da exclusão: permite recriar o test_result de uma
  -- avaliação concluída sem deixar a avaliação reaberta para o usuário.
  IF v_original_status = 'concluida' THEN
    PERFORM set_config('app.test_result_recovery_authorized', 'on', TRUE);

    UPDATE public.evaluations
    SET status = 'em_andamento'
    WHERE id = v_evaluation.id;
  END IF;

  IF v_audit.response_link_snapshot IS NOT NULL THEN
    PERFORM set_config('app.test_response_deletion_authorized', 'on', TRUE);

    INSERT INTO public.test_response_links (
      id,
      evaluation_id,
      patient_id,
      psicologo_id,
      form_code,
      share_token,
      respondent_type,
      respondent_name,
      relationship,
      status,
      responses,
      current_step,
      shared_at,
      responded_at,
      reviewed_at,
      expires_at,
      created_at,
      updated_at,
      calculation_count
    ) VALUES (
      v_response_link.id,
      v_response_link.evaluation_id,
      v_response_link.patient_id,
      v_response_link.psicologo_id,
      v_response_link.form_code,
      v_response_link.share_token,
      v_response_link.respondent_type,
      v_response_link.respondent_name,
      v_response_link.relationship,
      v_response_link.status,
      COALESCE(v_response_link.responses, '{}'::jsonb),
      COALESCE(v_response_link.current_step, 0),
      COALESCE(v_response_link.shared_at, NOW()),
      v_response_link.responded_at,
      v_response_link.reviewed_at,
      v_response_link.expires_at,
      COALESCE(v_response_link.created_at, NOW()),
      COALESCE(v_response_link.updated_at, NOW()),
      COALESCE(v_response_link.calculation_count, 0)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  PERFORM set_config('app.shared_response_calculation_authorized', 'on', TRUE);

  INSERT INTO public.test_results (
    id,
    evaluation_id,
    test_code,
    raw_scores,
    computed_scores,
    meta,
    created_at,
    updated_at,
    test_form_code,
    result_status,
    result_version,
    scoring_engine_version,
    normative_set_id,
    completed_at
  ) VALUES (
    v_result.id,
    v_result.evaluation_id,
    v_result.test_code,
    COALESCE(v_result.raw_scores, '{}'::jsonb),
    COALESCE(v_result.computed_scores, '{}'::jsonb),
    COALESCE(v_result.meta, '{}'::jsonb),
    COALESCE(v_result.created_at, NOW()),
    COALESCE(v_result.updated_at, NOW()),
    v_result.test_form_code,
    COALESCE(v_result.result_status, 'draft'),
    COALESCE(v_result.result_version, 1),
    v_result.scoring_engine_version,
    v_result.normative_set_id,
    v_result.completed_at
  );

  UPDATE public.test_deletion_audit
  SET
    restored_by = auth.uid(),
    restored_at = NOW(),
    restoration_method = 'professional_password'
  WHERE id = v_audit.id;

  IF v_original_status = 'concluida' THEN
    UPDATE public.evaluations
    SET status = 'concluida'
    WHERE id = v_evaluation.id;
  END IF;

  RETURN jsonb_build_object(
    'restored', TRUE,
    'form_code', v_audit.form_code,
    'test_result_id', v_result.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_applied_test(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_applied_test(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_applied_test(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_applied_test(UUID, TEXT) TO authenticated;
