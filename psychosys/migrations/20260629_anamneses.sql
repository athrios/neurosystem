CREATE TABLE IF NOT EXISTS anamneses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  psicologo_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_key    TEXT,
  nome            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho', 'compartilhada', 'respondida', 'revisada')),
  questions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  responses       JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_text     TEXT NOT NULL DEFAULT '',
  share_token     UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  shared_at       TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE anamneses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anamneses_select" ON anamneses;
CREATE POLICY "anamneses_select" ON anamneses FOR SELECT
  USING (psicologo_id = auth.uid() OR is_master());

DROP POLICY IF EXISTS "anamneses_insert" ON anamneses;
CREATE POLICY "anamneses_insert" ON anamneses FOR INSERT
  WITH CHECK (psicologo_id = auth.uid());

DROP POLICY IF EXISTS "anamneses_update" ON anamneses;
CREATE POLICY "anamneses_update" ON anamneses FOR UPDATE
  USING (psicologo_id = auth.uid() OR is_master());

DROP POLICY IF EXISTS "anamneses_delete" ON anamneses;
CREATE POLICY "anamneses_delete" ON anamneses FOR DELETE
  USING (psicologo_id = auth.uid() OR is_master());

DROP TRIGGER IF EXISTS trg_anamneses_updated ON anamneses;
CREATE TRIGGER trg_anamneses_updated
  BEFORE UPDATE ON anamneses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION get_shared_anamnesis(p_token UUID)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  patient_nome TEXT,
  questions JSONB,
  status TEXT
) AS $$
  SELECT a.id, a.nome, p.nome, a.questions, a.status
  FROM anamneses a
  JOIN patients p ON p.id = a.patient_id
  WHERE a.share_token = p_token
    AND a.status IN ('compartilhada', 'respondida');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION submit_shared_anamnesis(p_token UUID, p_responses JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE anamneses
  SET responses = p_responses,
      status = 'respondida',
      responded_at = NOW()
  WHERE share_token = p_token
    AND status IN ('compartilhada', 'respondida');

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_shared_anamnesis(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_shared_anamnesis(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_shared_anamnesis(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_shared_anamnesis(UUID, JSONB) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_anamneses_patient ON anamneses(patient_id);
CREATE INDEX IF NOT EXISTS idx_anamneses_psicologo ON anamneses(psicologo_id);
