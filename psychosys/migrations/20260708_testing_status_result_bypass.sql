--
-- Formulários em validação ('testing') continuam editáveis mesmo após a
-- avaliação ser concluída, alinhado com canEditTestApplication() no frontend
-- (psychosys/src/lib/test-access.js), que já libera edição nesse caso.
--
-- Sem este ajuste, o botão "Calcular e salvar" / "Salvar rascunho" fica
-- visível e clicável para formulários "testing" preenchidos pelo próprio
-- profissional (ex: WAIS-III, WASI) numa avaliação concluída, mas toda
-- tentativa de salvar falha com "Resultados de avaliação concluída não podem
-- ser alterados.", porque o trigger não conhecia o status do formulário.

CREATE OR REPLACE FUNCTION public.prevent_completed_test_result_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluation_id UUID;
  v_test_code TEXT;
  v_evaluation_completed BOOLEAN := FALSE;
  v_form_in_testing BOOLEAN := FALSE;
BEGIN
  IF public.is_test_result_recovery_authorized()
    OR COALESCE(current_setting('app.shared_response_calculation_authorized', TRUE), '') = 'on'
  THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  v_evaluation_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.evaluation_id
    ELSE NEW.evaluation_id
  END;
  v_test_code := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.test_code
    ELSE NEW.test_code
  END;

  SELECT EXISTS (
    SELECT 1 FROM public.test_forms form
    WHERE form.code = v_test_code
      AND form.implementation_status = 'testing'
  ) INTO v_form_in_testing;

  IF v_form_in_testing THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.evaluations evaluation
    WHERE evaluation.id = v_evaluation_id
      AND evaluation.status = 'concluida'
  )
  INTO v_evaluation_completed;

  IF v_evaluation_completed THEN
    RAISE EXCEPTION 'Resultados de avaliação concluída não podem ser alterados.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
