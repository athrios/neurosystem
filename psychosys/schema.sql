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
