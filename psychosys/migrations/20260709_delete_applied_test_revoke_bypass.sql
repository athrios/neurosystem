--
-- Corrige delete_applied_test: a revogação em massa de test_response_links
-- (status -> 'revoked') rodava antes de autorizar a exceção de exclusão,
-- então o trigger de imutabilidade de respostas de terceiros
-- (prevent_submitted_test_response_mutation) barrava a própria exclusão de
-- um teste já calculado com "Respostas recebidas de terceiros não podem
-- retornar para edição.". A autorização agora é ligada antes dessa etapa.

CREATE OR REPLACE FUNCTION public.prevent_submitted_test_response_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deletion_authorized BOOLEAN := FALSE;
BEGIN
  v_deletion_authorized := public.is_test_response_deletion_authorized();

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('submitted', 'reviewed')
      AND NOT v_deletion_authorized
    THEN
      RAISE EXCEPTION 'Respostas recebidas de terceiros não podem ser excluídas diretamente.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('submitted', 'reviewed') THEN
    IF NEW.responses IS DISTINCT FROM OLD.responses
      OR NEW.respondent_type IS DISTINCT FROM OLD.respondent_type
      OR NEW.respondent_name IS DISTINCT FROM OLD.respondent_name
      OR NEW.relationship IS DISTINCT FROM OLD.relationship
      OR NEW.responded_at IS DISTINCT FROM OLD.responded_at
      OR NEW.current_step IS DISTINCT FROM OLD.current_step
    THEN
      RAISE EXCEPTION 'Respostas recebidas de terceiros não podem ser alteradas.';
    END IF;

    IF NEW.status NOT IN ('submitted', 'reviewed')
      AND NOT (v_deletion_authorized AND NEW.status = 'revoked')
    THEN
      RAISE EXCEPTION 'Respostas recebidas de terceiros não podem retornar para edição.';
    END IF;

    IF (
      NEW.calculation_count IS DISTINCT FROM OLD.calculation_count
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.status IS DISTINCT FROM OLD.status
    )
      AND NOT public.is_shared_response_calculation_authorized()
      AND NOT (v_deletion_authorized AND NEW.status = 'revoked')
    THEN
      RAISE EXCEPTION 'A revisão da resposta recebida deve ocorrer pelo fluxo de cálculo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

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
      failed_attempts = CASE WHEN v_failed_attempts >= 3 THEN 0 ELSE v_failed_attempts END,
      locked_until = CASE WHEN v_failed_attempts >= 3
        THEN NOW() + INTERVAL '15 minutes'
        ELSE NULL
      END
    WHERE profile_id = auth.uid();

    RETURN jsonb_build_object(
      'deleted', FALSE,
      'code', CASE WHEN v_failed_attempts >= 3
        THEN 'password_locked'
        ELSE 'invalid_password'
      END,
      'message', CASE WHEN v_failed_attempts >= 3
        THEN 'Exclusão bloqueada após 3 tentativas inválidas. Tente novamente em 15 minutos.'
        ELSE 'Senha inválida. Exclusão não autorizada.'
      END,
      'attempts_remaining', GREATEST(3 - v_failed_attempts, 0)
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

  -- Exclusão autenticada por senha é uma exceção transacional para remover o
  -- resultado calculado sem reabrir a avaliação ou permitir edição.
  PERFORM set_config('app.test_result_recovery_authorized', 'on', TRUE);

  -- Autoriza a exceção ANTES de qualquer alteração em test_response_links,
  -- incluindo a revogação em massa abaixo, que também é bloqueada pelo
  -- trigger de imutabilidade quando o link já está 'submitted'/'reviewed'.
  PERFORM set_config('app.test_response_deletion_authorized', 'on', TRUE);

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
    DELETE FROM public.test_response_links
    WHERE id = v_response_link.id;
  END IF;

  DELETE FROM public.test_results
  WHERE id = v_result.id;

  RETURN jsonb_build_object(
    'deleted', TRUE,
    'form_code', p_form_code,
    'response_links_revoked', v_revoked_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_applied_test(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_applied_test(UUID, TEXT, TEXT) TO authenticated;
