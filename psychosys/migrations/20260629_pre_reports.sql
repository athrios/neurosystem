CREATE TABLE IF NOT EXISTS pre_reports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  psicologo_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description_demand  TEXT NOT NULL DEFAULT '',
  anamnesis_text      TEXT NOT NULL DEFAULT '',
  procedure_notes     TEXT NOT NULL DEFAULT '',
  comments            TEXT NOT NULL DEFAULT '',
  analysis_notes      TEXT NOT NULL DEFAULT '',
  form_results_text   TEXT NOT NULL DEFAULT '',
  summary             TEXT NOT NULL DEFAULT '',
  conclusion          TEXT NOT NULL DEFAULT '',
  referrals           TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'rascunho'
                      CHECK (status IN ('rascunho', 'revisado')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pre_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pre_reports_select" ON pre_reports;
CREATE POLICY "pre_reports_select" ON pre_reports FOR SELECT
  USING (psicologo_id = auth.uid() OR is_master());

DROP POLICY IF EXISTS "pre_reports_insert" ON pre_reports;
CREATE POLICY "pre_reports_insert" ON pre_reports FOR INSERT
  WITH CHECK (psicologo_id = auth.uid());

DROP POLICY IF EXISTS "pre_reports_update" ON pre_reports;
CREATE POLICY "pre_reports_update" ON pre_reports FOR UPDATE
  USING (psicologo_id = auth.uid() OR is_master());

DROP POLICY IF EXISTS "pre_reports_delete" ON pre_reports;
CREATE POLICY "pre_reports_delete" ON pre_reports FOR DELETE
  USING (psicologo_id = auth.uid() OR is_master());

DROP TRIGGER IF EXISTS trg_pre_reports_updated ON pre_reports;
CREATE TRIGGER trg_pre_reports_updated
  BEFORE UPDATE ON pre_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_pre_reports_psicologo ON pre_reports(psicologo_id);
