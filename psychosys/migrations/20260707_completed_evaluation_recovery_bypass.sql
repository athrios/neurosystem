--
-- Versiona o schema drift encontrado em produção:
--   - trg_evaluations_prevent_completed_changes
--   - trigger/function de proteção de test_results em avaliações concluídas
--
-- A regra geral continua a mesma: avaliações concluídas não devem ser
-- alteradas diretamente. A exceção abaixo só vale dentro da transação da RPC de
-- exclusão/restauração de testes, depois da senha do profissional já ter sido
-- validada.

CREATE OR REPLACE FUNCTION public.is_test_result_recovery_authorized()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.test_result_recovery_authorized', TRUE),
    ''
  ) = 'on';
$$;

CREATE OR REPLACE FUNCTION public.prevent_completed_evaluation_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.status = 'concluida'
    AND NOT public.is_test_result_recovery_authorized()
  THEN
    RAISE EXCEPTION 'Avaliação concluída não pode ser alterada.';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_trigger RECORD;
BEGIN
  FOR v_trigger IN
    SELECT trg.tgname
    FROM pg_trigger trg
    JOIN pg_class rel ON rel.oid = trg.tgrelid
    JOIN pg_namespace rel_ns ON rel_ns.oid = rel.relnamespace
    JOIN pg_proc proc ON proc.oid = trg.tgfoid
    JOIN pg_namespace proc_ns ON proc_ns.oid = proc.pronamespace
    WHERE NOT trg.tgisinternal
      AND rel_ns.nspname = 'public'
      AND rel.relname = 'evaluations'
      AND proc_ns.nspname = 'public'
      AND proc.proname = 'prevent_completed_evaluation_changes'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.evaluations',
      v_trigger.tgname
    );
  END LOOP;
END;
$$;

CREATE TRIGGER trg_evaluations_prevent_completed_changes
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_completed_evaluation_changes();

CREATE OR REPLACE FUNCTION public.prevent_completed_test_result_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluation_id UUID;
  v_evaluation_completed BOOLEAN := FALSE;
BEGIN
  IF public.is_test_result_recovery_authorized() THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  v_evaluation_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.evaluation_id
    ELSE NEW.evaluation_id
  END;

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

DO $$
DECLARE
  v_trigger RECORD;
BEGIN
  FOR v_trigger IN
    SELECT trg.tgname
    FROM pg_trigger trg
    JOIN pg_class rel ON rel.oid = trg.tgrelid
    JOIN pg_namespace rel_ns ON rel_ns.oid = rel.relnamespace
    JOIN pg_proc proc ON proc.oid = trg.tgfoid
    JOIN pg_namespace proc_ns ON proc_ns.oid = proc.pronamespace
    WHERE NOT trg.tgisinternal
      AND rel_ns.nspname = 'public'
      AND rel.relname = 'test_results'
      AND proc_ns.nspname = 'public'
      AND proc.proname = 'prevent_completed_test_result_changes'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.test_results',
      v_trigger.tgname
    );
  END LOOP;
END;
$$;

CREATE TRIGGER trg_test_results_prevent_completed_changes
  BEFORE INSERT OR UPDATE OR DELETE ON public.test_results
  FOR EACH ROW EXECUTE FUNCTION public.prevent_completed_test_result_changes();
