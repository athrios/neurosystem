-- Expiração obrigatória dos links públicos de testes.

-- Links legados passam a vencer 30 dias após a criação.
UPDATE public.test_response_links
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL
   OR expires_at <= created_at
   OR expires_at > created_at + INTERVAL '90 days';

ALTER TABLE public.test_response_links
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 days'),
  ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE public.test_response_links
  DROP CONSTRAINT IF EXISTS test_response_links_expiration_window;
ALTER TABLE public.test_response_links
  ADD CONSTRAINT test_response_links_expiration_window
  CHECK (
    expires_at > created_at
    AND expires_at <= created_at + INTERVAL '90 days'
  );

-- A conclusão de uma avaliação invalida imediatamente links ainda utilizáveis.
CREATE OR REPLACE FUNCTION public.revoke_test_links_on_evaluation_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.test_response_links
    SET status = 'revoked'
    WHERE evaluation_id = NEW.id
      AND status IN ('shared', 'in_progress', 'submitted');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_test_links_on_evaluation_completion
  ON public.evaluations;
CREATE TRIGGER trg_revoke_test_links_on_evaluation_completion
  AFTER UPDATE OF status ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.revoke_test_links_on_evaluation_completion();
