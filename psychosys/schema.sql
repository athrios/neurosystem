-- ============================================================
-- PsychoSys - Schema Supabase
-- ============================================================

-- Habilita UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PERFIS DE USUÁRIOS (estende auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'psicologo' CHECK (role IN ('master', 'psicologo')),
  nome          TEXT NOT NULL,
  crp           TEXT,
  cpf           TEXT,
  rg            TEXT,
  endereco      TEXT,
  complemento   TEXT,
  municipio     TEXT,
  uf            TEXT,
  cep           TEXT,
  fone          TEXT,
  email         TEXT,
  logo_data     TEXT,
  logo_alignment TEXT NOT NULL DEFAULT 'center'
                 CHECK (logo_alignment IN ('left', 'center', 'right')),
  footer_line1  TEXT,
  footer_line2  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PACIENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  psicologo_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nome              TEXT NOT NULL,
  data_nascimento   DATE,
  sexo              TEXT CHECK (sexo IN ('Masculino', 'Feminino', 'Outro')),
  escolaridade      TEXT,
  instituicao       TEXT,
  serie_ano         TEXT,
  lateralidade      TEXT DEFAULT 'Destro',
  anotacoes         JSONB DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AVALIAÇÕES (sessões de avaliação por paciente)
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  psicologo_id    UUID NOT NULL REFERENCES profiles(id),
  data_aplicacao  DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes     TEXT,
  status          TEXT DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluida')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RESULTADOS DOS TESTES
-- raw_scores e computed_scores em JSONB para flexibilidade
-- ============================================================
CREATE TABLE IF NOT EXISTS test_results (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluation_id   UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  test_code       TEXT NOT NULL,   -- ex: 'WISC_IV', 'RAVLT', 'TRILHAS'
  raw_scores      JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta            JSONB DEFAULT '{}'::jsonb,  -- dados extras (data aplicação, observações)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(evaluation_id, test_code)
);

-- ============================================================
-- DADOS NORMATIVOS (seed via script)
-- ============================================================
CREATE TABLE IF NOT EXISTS normative_data (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_code   TEXT NOT NULL,
  table_name  TEXT NOT NULL,  -- ex: 'WISC_IV_SUBTEST', 'WISC_IV_INDEX_ICV'
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS normative_data_unique 
  ON normative_data(test_code, table_name);

-- ============================================================
-- RECIBOS
-- ============================================================
CREATE TABLE IF NOT EXISTS receipts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  psicologo_id    UUID NOT NULL REFERENCES profiles(id),
  patient_id      UUID REFERENCES patients(id),
  numero          INT,
  data_emissao    DATE DEFAULT CURRENT_DATE,
  servicos        JSONB DEFAULT '[]'::jsonb,
  subtotal        DECIMAL(10,2) DEFAULT 0,
  desconto        DECIMAL(10,2) DEFAULT 0,
  acrescimo       DECIMAL(10,2) DEFAULT 0,
  total           DECIMAL(10,2) DEFAULT 0,
  tomador_nome    TEXT,
  tomador_cpf     TEXT,
  tomador_rg      TEXT,
  tomador_end     TEXT,
  tomador_fone    TEXT,
  tomador_email   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ANAMNESES E QUESTIONÁRIOS COMPARTILHÁVEIS
-- ============================================================
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
  current_step    INTEGER NOT NULL DEFAULT 0,
  draft_saved_at  TIMESTAMPTZ,
  shared_at       TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

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

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_patients_updated
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_evaluations_updated
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_test_results_updated
  BEFORE UPDATE ON test_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_anamneses_updated
  BEFORE UPDATE ON anamneses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pre_reports_updated
  BEFORE UPDATE ON pre_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: cria perfil automaticamente no signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo Usuário'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'psicologo')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE normative_data  ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamneses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_reports     ENABLE ROW LEVEL SECURITY;

-- Função helper: verifica se usuário é master
CREATE OR REPLACE FUNCTION is_master()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'master'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES: cada um vê o próprio; master vê todos
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR is_master());

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR is_master());

-- PATIENTS: psicólogo vê os seus; master vê todos
CREATE POLICY "patients_select" ON patients FOR SELECT
  USING (psicologo_id = auth.uid() OR is_master());

CREATE POLICY "patients_insert" ON patients FOR INSERT
  WITH CHECK (psicologo_id = auth.uid());

CREATE POLICY "patients_update" ON patients FOR UPDATE
  USING (psicologo_id = auth.uid() OR is_master());

CREATE POLICY "patients_delete" ON patients FOR DELETE
  USING (psicologo_id = auth.uid() OR is_master());

-- EVALUATIONS
CREATE POLICY "evaluations_select" ON evaluations FOR SELECT
  USING (psicologo_id = auth.uid() OR is_master());

CREATE POLICY "evaluations_insert" ON evaluations FOR INSERT
  WITH CHECK (psicologo_id = auth.uid());

CREATE POLICY "evaluations_update" ON evaluations FOR UPDATE
  USING (psicologo_id = auth.uid() OR is_master());

CREATE POLICY "evaluations_delete" ON evaluations FOR DELETE
  USING (psicologo_id = auth.uid() OR is_master());

-- TEST_RESULTS
CREATE POLICY "test_results_select" ON test_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e 
      WHERE e.id = evaluation_id 
      AND (e.psicologo_id = auth.uid() OR is_master())
    )
  );

CREATE POLICY "test_results_insert" ON test_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e 
      WHERE e.id = evaluation_id AND e.psicologo_id = auth.uid()
    )
  );

CREATE POLICY "test_results_update" ON test_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e 
      WHERE e.id = evaluation_id 
      AND (e.psicologo_id = auth.uid() OR is_master())
    )
  );

-- NORMATIVE_DATA: todos podem ler
CREATE POLICY "normative_read" ON normative_data FOR SELECT
  USING (true);

CREATE POLICY "normative_write" ON normative_data FOR ALL
  USING (is_master());

-- RECEIPTS
CREATE POLICY "receipts_select" ON receipts FOR SELECT
  USING (psicologo_id = auth.uid() OR is_master());

CREATE POLICY "receipts_insert" ON receipts FOR INSERT
  WITH CHECK (psicologo_id = auth.uid());

CREATE POLICY "receipts_update" ON receipts FOR UPDATE
  USING (psicologo_id = auth.uid() OR is_master());

-- ANAMNESES: acesso integral apenas pelo profissional responsável ou master
CREATE POLICY "anamneses_select" ON anamneses FOR SELECT
  USING (psicologo_id = auth.uid() OR is_master());

CREATE POLICY "anamneses_insert" ON anamneses FOR INSERT
  WITH CHECK (psicologo_id = auth.uid());

CREATE POLICY "anamneses_update" ON anamneses FOR UPDATE
  USING (psicologo_id = auth.uid() OR is_master());

CREATE POLICY "anamneses_delete" ON anamneses FOR DELETE
  USING (psicologo_id = auth.uid() OR is_master());

CREATE POLICY "pre_reports_select" ON pre_reports FOR SELECT
  USING (psicologo_id = auth.uid() OR is_master());

CREATE POLICY "pre_reports_insert" ON pre_reports FOR INSERT
  WITH CHECK (psicologo_id = auth.uid());

CREATE POLICY "pre_reports_update" ON pre_reports FOR UPDATE
  USING (psicologo_id = auth.uid() OR is_master());

CREATE POLICY "pre_reports_delete" ON pre_reports FOR DELETE
  USING (psicologo_id = auth.uid() OR is_master());

-- O paciente acessa somente o formulário identificado pelo token recebido.
CREATE OR REPLACE FUNCTION get_shared_anamnesis(p_token UUID)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  patient_nome TEXT,
  questions JSONB,
  responses JSONB,
  current_step INTEGER,
  status TEXT,
  logo_data TEXT,
  logo_alignment TEXT,
  footer_line1 TEXT,
  footer_line2 TEXT
) AS $$
  SELECT
    a.id, a.nome, p.nome, a.questions, a.responses, a.current_step, a.status,
    pr.logo_data, pr.logo_alignment, pr.footer_line1, pr.footer_line2
  FROM anamneses a
  JOIN patients p ON p.id = a.patient_id
  JOIN profiles pr ON pr.id = a.psicologo_id
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

-- ============================================================
-- VIEWS ÚTEIS
-- ============================================================

-- Vista: pacientes com idade calculada
CREATE OR REPLACE VIEW patients_view AS
SELECT 
  p.*,
  pr.nome AS psicologo_nome,
  pr.crp  AS psicologo_crp,
  CASE 
    WHEN p.data_nascimento IS NOT NULL 
    THEN EXTRACT(YEAR FROM AGE(p.data_nascimento))::INT
    ELSE NULL
  END AS idade_anos,
  CASE 
    WHEN p.data_nascimento IS NOT NULL 
    THEN (CURRENT_DATE - p.data_nascimento)
    ELSE NULL
  END AS idade_dias
FROM patients p
JOIN profiles pr ON p.psicologo_id = pr.id;

-- Vista: avaliações com dados do paciente
CREATE OR REPLACE VIEW evaluations_view AS
SELECT 
  e.*,
  p.nome          AS patient_nome,
  p.data_nascimento AS patient_dob,
  p.sexo          AS patient_sexo,
  p.escolaridade  AS patient_escolaridade,
  pr.nome         AS psicologo_nome,
  pr.crp          AS psicologo_crp,
  (CURRENT_DATE - COALESCE(p.data_nascimento, CURRENT_DATE)) AS idade_dias_aplicacao
FROM evaluations e
JOIN patients p ON e.patient_id = p.id
JOIN profiles pr ON e.psicologo_id = pr.id;

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patients_psicologo ON patients(psicologo_id);
CREATE INDEX IF NOT EXISTS idx_patients_nome ON patients(nome);
CREATE INDEX IF NOT EXISTS idx_evaluations_patient ON evaluations(patient_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_psicologo ON evaluations(psicologo_id);
CREATE INDEX IF NOT EXISTS idx_test_results_evaluation ON test_results(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_test_results_code ON test_results(test_code);
CREATE INDEX IF NOT EXISTS idx_normative_code ON normative_data(test_code, table_name);
CREATE INDEX IF NOT EXISTS idx_anamneses_patient ON anamneses(patient_id);
CREATE INDEX IF NOT EXISTS idx_anamneses_psicologo ON anamneses(psicologo_id);
CREATE INDEX IF NOT EXISTS idx_pre_reports_psicologo ON pre_reports(psicologo_id);
