ALTER TABLE anamneses
  ADD COLUMN IF NOT EXISTS current_step INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draft_saved_at TIMESTAMPTZ;

DROP FUNCTION IF EXISTS get_shared_anamnesis(UUID);

CREATE FUNCTION get_shared_anamnesis(p_token UUID)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  patient_nome TEXT,
  questions JSONB,
  responses JSONB,
  current_step INTEGER,
  status TEXT
) AS $$
  SELECT
    a.id,
    a.nome,
    p.nome,
    a.questions,
    a.responses,
    a.current_step,
    a.status
  FROM anamneses a
  JOIN patients p ON p.id = a.patient_id
  WHERE a.share_token = p_token
    AND a.status IN ('compartilhada', 'respondida');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION save_shared_anamnesis_draft(
  p_token UUID,
  p_responses JSONB,
  p_current_step INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE anamneses
  SET responses = p_responses,
      current_step = GREATEST(p_current_step, 0),
      draft_saved_at = NOW()
  WHERE share_token = p_token
    AND status = 'compartilhada';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION submit_shared_anamnesis(p_token UUID, p_responses JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE anamneses
  SET responses = p_responses,
      status = 'respondida',
      current_step = 0,
      responded_at = NOW()
  WHERE share_token = p_token
    AND status IN ('compartilhada', 'respondida');

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_shared_anamnesis(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_shared_anamnesis_draft(UUID, JSONB, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_shared_anamnesis(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_shared_anamnesis(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION save_shared_anamnesis_draft(UUID, JSONB, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_shared_anamnesis(UUID, JSONB) TO anon, authenticated;
