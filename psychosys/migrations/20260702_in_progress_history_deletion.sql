-- Exclusão de históricos ainda em andamento e correção da data local de aplicação.

-- O banco do Supabase opera em UTC. A data clínica deve seguir São Paulo.
ALTER TABLE public.evaluations
  ALTER COLUMN data_aplicacao
  SET DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date);

-- Corrige registros criados pela conversão UTC que avançou exatamente um dia.
UPDATE public.evaluations
SET data_aplicacao = (created_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE status = 'em_andamento'
  AND data_aplicacao = (
    (created_at AT TIME ZONE 'America/Sao_Paulo')::date + 1
  );

-- Avaliações concluídas não podem ser removidas do histórico.
DROP POLICY IF EXISTS "evaluations_delete" ON public.evaluations;
CREATE POLICY "evaluations_delete"
  ON public.evaluations FOR DELETE
  USING (
    status = 'em_andamento'
    AND (psicologo_id = auth.uid() OR is_master())
  );

-- Escalas respondidas ou revisadas também permanecem no histórico.
DROP POLICY IF EXISTS "anamneses_delete" ON public.anamneses;
CREATE POLICY "anamneses_delete"
  ON public.anamneses FOR DELETE
  USING (
    status IN ('rascunho', 'compartilhada')
    AND (psicologo_id = auth.uid() OR is_master())
  );

