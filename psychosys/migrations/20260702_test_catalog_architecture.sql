-- ============================================================
-- PsychoSys - Plataforma extensível de testes
-- Catálogo: 46 instrumentos / 56 formulários da planilha 3.7.2d
--
-- Esta migração:
--   1. não remove nem renomeia estruturas existentes;
--   2. preserva test_results.test_code e normative_data;
--   3. acrescenta catálogo, formulários versionados e normas versionadas;
--   4. cadastra somente metadados, nunca itens protegidos dos instrumentos.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- Classificação funcional
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_categories (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Instrumento = família conceitual (ex.: SRS-2)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_instruments (
  code          TEXT PRIMARY KEY,
  category_code TEXT NOT NULL REFERENCES test_categories(code)
                ON UPDATE CASCADE ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  acronym       TEXT,
  description   TEXT,
  source_system TEXT NOT NULL DEFAULT 'PsychoSys 3.7.2d',
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb
                CHECK (jsonb_typeof(metadata) = 'object'),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Formulário = versão aplicável/corrigível de um instrumento
-- Os schemas JSONB permitem incorporar novos testes sem alterar tabelas.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_forms (
  code                  TEXT PRIMARY KEY,
  instrument_code       TEXT NOT NULL REFERENCES test_instruments(code)
                        ON UPDATE CASCADE ON DELETE RESTRICT,
  name                  TEXT NOT NULL,
  source_sheet          TEXT,
  respondent_type       TEXT NOT NULL DEFAULT 'professional'
                        CHECK (respondent_type IN (
                          'patient', 'parent', 'teacher', 'caregiver',
                          'interview', 'professional', 'other'
                        )),
  form_type              TEXT NOT NULL DEFAULT 'standard',
  min_age_months         INTEGER CHECK (min_age_months IS NULL OR min_age_months >= 0),
  max_age_months         INTEGER CHECK (
                          max_age_months IS NULL OR
                          (max_age_months >= 0 AND
                           (min_age_months IS NULL OR max_age_months >= min_age_months))
                        ),
  definition_version     INTEGER NOT NULL DEFAULT 1
                        CHECK (definition_version > 0),
  engine_key             TEXT,
  engine_version         TEXT,
  administration_schema JSONB NOT NULL DEFAULT '{}'::jsonb
                        CHECK (jsonb_typeof(administration_schema) = 'object'),
  scoring_schema         JSONB NOT NULL DEFAULT '{}'::jsonb
                        CHECK (jsonb_typeof(scoring_schema) = 'object'),
  report_schema          JSONB NOT NULL DEFAULT '{}'::jsonb
                        CHECK (jsonb_typeof(report_schema) = 'object'),
  implementation_status  TEXT NOT NULL DEFAULT 'catalogued'
                        CHECK (implementation_status IN (
                          'catalogued', 'modeling', 'testing', 'active', 'retired'
                        )),
  active                 BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  metadata               JSONB NOT NULL DEFAULT '{}'::jsonb
                        CHECK (jsonb_typeof(metadata) = 'object'),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Conjuntos normativos e suas tabelas
-- Um formulário pode possuir várias populações/fontes/edições.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_normative_sets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_code         TEXT NOT NULL REFERENCES test_forms(code)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
  code              TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  title             TEXT NOT NULL,
  source_reference  TEXT,
  population        JSONB NOT NULL DEFAULT '{}'::jsonb
                    CHECK (jsonb_typeof(population) = 'object'),
  selection_rules   JSONB NOT NULL DEFAULT '{}'::jsonb
                    CHECK (jsonb_typeof(selection_rules) = 'object'),
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN (
                      'draft', 'imported', 'validated', 'published', 'retired'
                    )),
  checksum          TEXT,
  valid_from        DATE,
  valid_until       DATE,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
                    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (form_code, code, version),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE IF NOT EXISTS test_normative_tables (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  normative_set_id  UUID NOT NULL REFERENCES test_normative_sets(id)
                    ON DELETE CASCADE,
  code              TEXT NOT NULL,
  dimensions        JSONB NOT NULL DEFAULT '{}'::jsonb
                    CHECK (jsonb_typeof(dimensions) = 'object'),
  data              JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
                    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (normative_set_id, code)
);

-- ------------------------------------------------------------
-- Evolução compatível dos resultados existentes
-- ------------------------------------------------------------
ALTER TABLE test_results
  ADD COLUMN IF NOT EXISTS test_form_code TEXT
    REFERENCES test_forms(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS result_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (result_status IN ('draft', 'scored', 'reviewed', 'invalidated')),
  ADD COLUMN IF NOT EXISTS result_version INTEGER NOT NULL DEFAULT 1
    CHECK (result_version > 0),
  ADD COLUMN IF NOT EXISTS scoring_engine_version TEXT,
  ADD COLUMN IF NOT EXISTS normative_set_id UUID
    REFERENCES test_normative_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- Catálogo inicial
-- ------------------------------------------------------------
INSERT INTO test_categories (code, name, sort_order) VALUES
  ('INTELLIGENCE', 'Eficiência intelectual', 10),
  ('ATTENTION', 'Atenção', 20),
  ('MEMORY', 'Memória', 30),
  ('EXECUTIVE', 'Funções executivas', 40),
  ('LANGUAGE', 'Linguagem', 50),
  ('ACADEMIC', 'Habilidades acadêmicas', 60),
  ('BEHAVIOR', 'Comportamento e sintomas', 70),
  ('PERSONALITY', 'Personalidade', 80),
  ('DEVELOPMENT', 'Desenvolvimento e comportamento adaptativo', 90),
  ('VISUOCONSTRUCTION', 'Visuoconstrução', 100),
  ('NEUROPSYCHOLOGY', 'Avaliação neuropsicológica', 110)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO test_instruments
  (code, category_code, name, acronym, description, sort_order)
VALUES
  ('SETE_FIG_SETE_PAL', 'MEMORY', '7 Figuras / 7 Palavras', '7FIG-7PAL', NULL, 10),
  ('AC', 'ATTENTION', 'Atenção Concentrada', 'AC', NULL, 20),
  ('AC_15', 'ATTENTION', 'Atenção Concentrada 15', 'AC-15', NULL, 30),
  ('BAMS', 'MEMORY', 'Bateria de Avaliação da Memória Semântica', 'BAMS', NULL, 40),
  ('BFP', 'PERSONALITY', 'Bateria Fatorial de Personalidade', 'BFP', NULL, 50),
  ('CORSI', 'EXECUTIVE', 'Blocos de Corsi', 'Corsi', NULL, 60),
  ('BOSTON', 'LANGUAGE', 'Teste de Nomeação de Boston', 'Boston', NULL, 70),
  ('BPA', 'ATTENTION', 'Bateria Psicológica para Avaliação da Atenção', 'BPA', NULL, 80),
  ('BRIEF_P', 'BEHAVIOR', 'BRIEF-P', 'BRIEF-P', NULL, 90),
  ('BRIEF_2', 'BEHAVIOR', 'BRIEF-2', 'BRIEF-2', NULL, 100),
  ('BVMT_R', 'MEMORY', 'BVMT-R', 'BVMT-R', NULL, 110),
  ('CBCL', 'BEHAVIOR', 'CBCL 6–18 anos', 'CBCL', NULL, 120),
  ('D2_R', 'ATTENTION', 'D2-R', 'D2-R', NULL, 130),
  ('ETDAH', 'BEHAVIOR', 'E-TDAH', 'E-TDAH', NULL, 140),
  ('FDT', 'EXECUTIVE', 'Five Digit Test', 'FDT', NULL, 150),
  ('FIG_REY', 'VISUOCONSTRUCTION', 'Figuras Complexas de Rey', 'Rey', NULL, 160),
  ('TFV', 'LANGUAGE', 'Teste de Fluência Verbal', 'TFV', NULL, 170),
  ('GO_NO_GO', 'EXECUTIVE', 'GO / NO-GO', 'GO/NO-GO', NULL, 180),
  ('HAYLING', 'EXECUTIVE', 'Teste de Hayling', 'Hayling', NULL, 190),
  ('HVLT_R', 'MEMORY', 'HVLT-R', 'HVLT-R', NULL, 200),
  ('IEP', 'BEHAVIOR', 'Inventário de Estilos Parentais', 'IEP', NULL, 210),
  ('NEPSY_2', 'NEUROPSYCHOLOGY', 'NEPSY-II', 'NEPSY-II', NULL, 220),
  ('NEUPSILIN_INF', 'NEUROPSYCHOLOGY', 'Neupsilin Infantil', 'Neupsilin-Inf', NULL, 230),
  ('NOMEACAO_SEABRA', 'LANGUAGE', 'Teste Infantil de Nomeação — Seabra', 'Nomeação', NULL, 240),
  ('PROVA_ARITMETICA', 'ACADEMIC', 'Prova de Aritmética', 'PA', NULL, 250),
  ('PED_VR', 'ACADEMIC', 'Prova de Escrita sob Ditado', 'PED-VR', NULL, 260),
  ('PEP_R', 'DEVELOPMENT', 'Perfil Psicoeducacional Revisado', 'PEP-R', NULL, 270),
  ('PFISTER', 'PERSONALITY', 'Pirâmides Coloridas de Pfister', 'Pfister', NULL, 280),
  ('PROLEC', 'ACADEMIC', 'PROLEC', 'PROLEC', NULL, 290),
  ('QEDP', 'BEHAVIOR', 'Questionário de Estilos Parentais', 'QEDP', NULL, 300),
  ('RAVLT', 'MEMORY', 'Teste de Aprendizagem Auditivo-Verbal de Rey', 'RAVLT', NULL, 310),
  ('SCARED', 'BEHAVIOR', 'SCARED', 'SCARED', NULL, 320),
  ('SDQ', 'BEHAVIOR', 'Questionário de Capacidades e Dificuldades', 'SDQ', NULL, 330),
  ('SNAP_IV', 'BEHAVIOR', 'SNAP-IV', 'SNAP-IV', NULL, 340),
  ('SRS_2', 'BEHAVIOR', 'Escala de Responsividade Social — Segunda Edição', 'SRS-2', NULL, 350),
  ('STROOP', 'EXECUTIVE', 'Teste de Stroop', 'Stroop', NULL, 360),
  ('TDE_2', 'ACADEMIC', 'Teste de Desempenho Escolar — Segunda Edição', 'TDE-2', NULL, 370),
  ('THCP', 'ACADEMIC', 'THCP', 'THCP', NULL, 380),
  ('TOKEN', 'LANGUAGE', 'Token Test', 'Token', NULL, 390),
  ('TOL', 'EXECUTIVE', 'Torre de Londres', 'TOL', NULL, 400),
  ('TRILHAS', 'EXECUTIVE', 'Teste de Trilhas', 'Trilhas', NULL, 410),
  ('VINELAND_3', 'DEVELOPMENT', 'Vineland Adaptive Behavior Scales — Terceira Edição', 'Vineland-3', NULL, 420),
  ('WAIS_III', 'INTELLIGENCE', 'Escala Wechsler de Inteligência para Adultos — Terceira Edição', 'WAIS-III', NULL, 430),
  ('WASI', 'INTELLIGENCE', 'Escala Wechsler Abreviada de Inteligência', 'WASI', NULL, 440),
  ('WISC_IV', 'INTELLIGENCE', 'Escala Wechsler de Inteligência para Crianças — Quarta Edição', 'WISC-IV', NULL, 450),
  ('WISCONSIN_48', 'EXECUTIVE', 'Wisconsin Modificado — 48 cartas', 'WCST-48', NULL, 460)
ON CONFLICT (code) DO UPDATE SET
  category_code = EXCLUDED.category_code,
  name = EXCLUDED.name,
  acronym = EXCLUDED.acronym,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO test_forms
  (code, instrument_code, name, source_sheet, respondent_type, form_type,
   engine_key, engine_version, implementation_status, sort_order, metadata)
VALUES
  ('SETE_FIG_SETE_PAL', 'SETE_FIG_SETE_PAL', '7 Figuras / 7 Palavras', '7FIG-7PAL', 'professional', 'standard', NULL, NULL, 'catalogued', 10, '{"menu_visibility":"hidden"}'),
  ('AC', 'AC', 'AC', 'AC', 'professional', 'standard', NULL, NULL, 'catalogued', 20, '{}'),
  ('AC_15', 'AC_15', 'AC-15', 'AC-15', 'professional', 'standard', NULL, NULL, 'catalogued', 30, '{}'),
  ('BAMS', 'BAMS', 'BAMS', 'BAMS', 'professional', 'standard', NULL, NULL, 'catalogued', 40, '{}'),
  ('BFP', 'BFP', 'BFP', 'BFP', 'professional', 'standard', NULL, NULL, 'catalogued', 50, '{}'),
  ('CORSI', 'CORSI', 'Blocos de Corsi', 'Corsi', 'professional', 'standard', NULL, NULL, 'catalogued', 60, '{"companion_sheets":["CORSI1"]}'),
  ('BOSTON', 'BOSTON', 'Boston', 'NOMEAÇÃO', 'professional', 'standard', NULL, NULL, 'catalogued', 70, '{}'),
  ('BPA', 'BPA', 'BPA', 'BPA', 'professional', 'standard', NULL, NULL, 'catalogued', 80, '{}'),
  ('BRIEF_P', 'BRIEF_P', 'BRIEF-P — Pré-escolar', 'BRIEF-P', 'parent', 'preschool', NULL, NULL, 'catalogued', 90, '{}'),
  ('BRIEF_2', 'BRIEF_2', 'BRIEF-2', 'BRIEF-2', 'parent', 'standard', NULL, NULL, 'catalogued', 100, '{}'),
  ('BVMT_R', 'BVMT_R', 'BVMT-R', 'BVMT-R', 'professional', 'standard', NULL, NULL, 'catalogued', 110, '{}'),
  ('CBCL', 'CBCL', 'CBCL — 6 a 18 anos', 'CBCL', 'parent', '6-18', NULL, NULL, 'catalogued', 120, '{}'),
  ('D2_R', 'D2_R', 'D2-R', 'D2-R', 'professional', 'standard', NULL, NULL, 'catalogued', 130, '{}'),
  ('ETDAH_AD', 'ETDAH', 'E-TDAH — Adultos', 'ETDAH-AD', 'patient', 'adult', NULL, NULL, 'catalogued', 140, '{}'),
  ('ETDAH_CRI_AD', 'ETDAH', 'E-TDAH — Crianças e adolescentes', 'ETDAH-CriAd', 'patient', 'child_adolescent', NULL, NULL, 'catalogued', 150, '{}'),
  ('ETDAH_PAIS', 'ETDAH', 'E-TDAH — Pais', 'ETDAH-Pais', 'parent', 'parent', NULL, NULL, 'catalogued', 160, '{}'),
  ('ETDAH_2_PROF', 'ETDAH', 'E-TDAH-2 — Professores', 'ETDAH-2', 'teacher', 'teacher', NULL, NULL, 'catalogued', 170, '{}'),
  ('FDT', 'FDT', 'FDT', 'FDT', 'professional', 'standard', NULL, NULL, 'catalogued', 180, '{}'),
  ('FIG_REY', 'FIG_REY', 'Figuras Complexas de Rey', 'FigRey', 'professional', 'standard', NULL, NULL, 'catalogued', 190, '{}'),
  ('TFV', 'TFV', 'Fluência Verbal — TFV', 'TFV', 'professional', 'standard', NULL, NULL, 'catalogued', 200, '{}'),
  ('GO_NO_GO', 'GO_NO_GO', 'GO / NO-GO', 'GO-NO GO', 'professional', 'standard', NULL, NULL, 'catalogued', 210, '{}'),
  ('HAYLING', 'HAYLING', 'Hayling', 'Hayling', 'professional', 'standard', NULL, NULL, 'catalogued', 220, '{}'),
  ('HVLT_R', 'HVLT_R', 'HVLT-R', 'HVLT-R', 'professional', 'standard', NULL, NULL, 'catalogued', 230, '{}'),
  ('IEP', 'IEP', 'Inventário de Estilos Parentais', 'IEP', 'parent', 'standard', NULL, NULL, 'catalogued', 240, '{}'),
  ('NEPSY_2', 'NEPSY_2', 'NEPSY-II', 'Nepsy-2', 'professional', 'standard', NULL, NULL, 'catalogued', 250, '{}'),
  ('NEUPSILIN_INF', 'NEUPSILIN_INF', 'Neupsilin Infantil', 'Neupsilin-Inf', 'professional', 'standard', NULL, NULL, 'catalogued', 260, '{}'),
  ('NOMEACAO_SEABRA', 'NOMEACAO_SEABRA', 'Nomeação — Seabra', 'NOMEAÇÃO', 'professional', 'standard', NULL, NULL, 'catalogued', 270, '{}'),
  ('PROVA_ARITMETICA', 'PROVA_ARITMETICA', 'Prova de Aritmética', 'Prova_Aritmética', 'professional', 'standard', NULL, NULL, 'catalogued', 280, '{}'),
  ('PED_VR', 'PED_VR', 'PED-VR', 'PED-vr', 'professional', 'standard', NULL, NULL, 'catalogued', 290, '{}'),
  ('PEP_R', 'PEP_R', 'PEP-R', 'PEP-R', 'professional', 'standard', NULL, NULL, 'catalogued', 300, '{}'),
  ('PFISTER', 'PFISTER', 'Pfister', 'Pfister', 'professional', 'standard', NULL, NULL, 'catalogued', 310, '{}'),
  ('PROLEC', 'PROLEC', 'PROLEC', 'Prolec', 'professional', 'standard', NULL, NULL, 'catalogued', 320, '{}'),
  ('QEDP', 'QEDP', 'QEDP', 'QEDP', 'parent', 'standard', NULL, NULL, 'catalogued', 330, '{}'),
  ('RAVLT', 'RAVLT', 'RAVLT', 'RAVLT', 'professional', 'standard', NULL, NULL, 'catalogued', 340, '{}'),
  ('SCARED', 'SCARED', 'SCARED', 'SCARED', 'patient', 'standard', NULL, NULL, 'catalogued', 350, '{}'),
  ('SDQ_PR', 'SDQ', 'SDQ', 'SDQ-Pr', 'parent', 'parent', NULL, NULL, 'catalogued', 360, '{}'),
  ('SNAP_IV', 'SNAP_IV', 'SNAP-IV', 'SNAP-IV', 'other', 'standard', NULL, NULL, 'catalogued', 370, '{}'),
  ('SRS_2_ADULTOS', 'SRS_2', 'SRS-2 — Adultos', 'SRS2_Adultos', 'other', 'adult', NULL, NULL, 'catalogued', 380, '{}'),
  ('SRS_2_ESCOLAR', 'SRS_2', 'SRS-2 — Escolar', 'SRS2_Escolar', 'other', 'school_age', NULL, NULL, 'catalogued', 390, '{}'),
  ('SRS_2_PRE_ESCOLAR', 'SRS_2', 'SRS-2 — Pré-escolar', 'SRS2_Pre_Escolar', 'other', 'preschool', NULL, NULL, 'catalogued', 400, '{}'),
  ('STROOP', 'STROOP', 'Stroop', 'STROOP', 'professional', 'standard', NULL, NULL, 'catalogued', 410, '{}'),
  ('TDE_2', 'TDE_2', 'TDE-2', 'TDE2', 'professional', 'standard', NULL, NULL, 'catalogued', 420, '{}'),
  ('THCP', 'THCP', 'THCP', 'THCP', 'professional', 'standard', NULL, NULL, 'catalogued', 430, '{}'),
  ('TOKEN', 'TOKEN', 'Token', 'TOKEN', 'professional', 'standard', NULL, NULL, 'catalogued', 440, '{}'),
  ('TOL', 'TOL', 'Torre de Londres', 'TOL', 'professional', 'standard', NULL, NULL, 'catalogued', 450, '{}'),
  ('TRILHAS', 'TRILHAS', 'Trilhas', 'TRILHAS', 'professional', 'standard', NULL, NULL, 'catalogued', 460, '{}'),
  ('VINELAND_3_EXT_ENT', 'VINELAND_3', 'Vineland-3 — Extensivo — Entrevista', 'Vin_3_Ext_Ent', 'interview', 'extended', NULL, NULL, 'catalogued', 470, '{}'),
  ('VINELAND_3_EXT_PAIS', 'VINELAND_3', 'Vineland-3 — Extensivo — Pais', 'Vin_3_Ext_Pais', 'parent', 'extended', NULL, NULL, 'catalogued', 480, '{}'),
  ('VINELAND_3_EXT_PROF', 'VINELAND_3', 'Vineland-3 — Extensivo — Professores', 'Vin_3_Ext_Prof', 'teacher', 'extended', NULL, NULL, 'catalogued', 490, '{}'),
  ('VINELAND_3_DOM_ENT', 'VINELAND_3', 'Vineland-3 — Domínio — Entrevista', 'Vin_3_Dom_Ent', 'interview', 'domain', NULL, NULL, 'catalogued', 500, '{}'),
  ('VINELAND_3_DOM_PAIS', 'VINELAND_3', 'Vineland-3 — Domínio — Pais', 'Vin_3_Dom_Pais', 'parent', 'domain', NULL, NULL, 'catalogued', 510, '{}'),
  ('VINELAND_3_DOM_PROF', 'VINELAND_3', 'Vineland-3 — Domínio — Professores', 'Vin_3_Dom_Prof', 'teacher', 'domain', NULL, NULL, 'catalogued', 520, '{}'),
  ('WAIS_III', 'WAIS_III', 'WAIS-III', 'WAIS-III', 'professional', 'standard', NULL, NULL, 'catalogued', 530, '{}'),
  ('WASI', 'WASI', 'WASI', 'WASI', 'professional', 'standard', NULL, NULL, 'catalogued', 540, '{}'),
  ('WISC_IV', 'WISC_IV', 'WISC-IV', 'WISC-IV', 'professional', 'standard', 'wisc-iv', '1', 'active', 550, '{}'),
  ('WISCONSIN_48', 'WISCONSIN_48', 'Wisconsin — 48 cartas', 'WSCT48', 'professional', '48_cards', NULL, NULL, 'catalogued', 560, '{"companion_sheets":["WSCT48-R","WISCONSIN"]}')
ON CONFLICT (code) DO UPDATE SET
  instrument_code = EXCLUDED.instrument_code,
  name = EXCLUDED.name,
  source_sheet = EXCLUDED.source_sheet,
  respondent_type = EXCLUDED.respondent_type,
  form_type = EXCLUDED.form_type,
  sort_order = EXCLUDED.sort_order,
  metadata = test_forms.metadata || EXCLUDED.metadata,
  updated_at = NOW();

-- Vincula os resultados legados ao catálogo quando os códigos coincidem.
UPDATE test_results result
SET test_form_code = result.test_code
WHERE result.test_form_code IS NULL
  AND EXISTS (
    SELECT 1 FROM test_forms form WHERE form.code = result.test_code
  );

-- Importa as normas legadas sem alterar a tabela de origem.
INSERT INTO test_normative_sets
  (form_code, code, version, title, status, metadata)
SELECT DISTINCT
  legacy.test_code,
  'LEGACY_IMPORT',
  1,
  'Importação da tabela normative_data',
  'imported',
  jsonb_build_object('source_table', 'normative_data')
FROM normative_data legacy
JOIN test_forms form ON form.code = legacy.test_code
ON CONFLICT (form_code, code, version) DO NOTHING;

INSERT INTO test_normative_tables
  (normative_set_id, code, dimensions, data, metadata)
SELECT
  normative_set.id,
  legacy.table_name,
  COALESCE(legacy.meta, '{}'::jsonb),
  legacy.data,
  jsonb_build_object('legacy_normative_data_id', legacy.id)
FROM normative_data legacy
JOIN test_normative_sets normative_set
  ON normative_set.form_code = legacy.test_code
 AND normative_set.code = 'LEGACY_IMPORT'
 AND normative_set.version = 1
ON CONFLICT (normative_set_id, code) DO NOTHING;

-- Mantém test_code compatível com os clientes atuais e associa o formulário.
CREATE OR REPLACE FUNCTION sync_test_result_form()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.test_form_code IS NOT NULL THEN
    NEW.test_code := NEW.test_form_code;
  ELSIF EXISTS (SELECT 1 FROM test_forms WHERE code = NEW.test_code) THEN
    NEW.test_form_code := NEW.test_code;
  END IF;

  IF NEW.result_status IN ('scored', 'reviewed') AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_results_sync_form ON test_results;
CREATE TRIGGER trg_test_results_sync_form
  BEFORE INSERT OR UPDATE OF test_code, test_form_code, result_status
  ON test_results
  FOR EACH ROW EXECUTE FUNCTION sync_test_result_form();

-- Usa a função de updated_at já existente no schema principal.
DROP TRIGGER IF EXISTS trg_test_categories_updated ON test_categories;
CREATE TRIGGER trg_test_categories_updated
  BEFORE UPDATE ON test_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_test_instruments_updated ON test_instruments;
CREATE TRIGGER trg_test_instruments_updated
  BEFORE UPDATE ON test_instruments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_test_forms_updated ON test_forms;
CREATE TRIGGER trg_test_forms_updated
  BEFORE UPDATE ON test_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_test_normative_sets_updated ON test_normative_sets;
CREATE TRIGGER trg_test_normative_sets_updated
  BEFORE UPDATE ON test_normative_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_test_normative_tables_updated ON test_normative_tables;
CREATE TRIGGER trg_test_normative_tables_updated
  BEFORE UPDATE ON test_normative_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- Consulta estável para a aplicação
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW test_catalog_view AS
SELECT
  form.code AS form_code,
  form.name AS form_name,
  form.form_type,
  form.respondent_type,
  form.min_age_months,
  form.max_age_months,
  form.definition_version,
  form.engine_key,
  form.engine_version,
  form.implementation_status,
  form.active,
  form.sort_order,
  form.source_sheet,
  instrument.code AS instrument_code,
  instrument.name AS instrument_name,
  instrument.acronym,
  instrument.description,
  category.code AS category_code,
  category.name AS category_name
FROM test_forms form
JOIN test_instruments instrument ON instrument.code = form.instrument_code
JOIN test_categories category ON category.code = instrument.category_code;

-- ------------------------------------------------------------
-- Segurança
-- ------------------------------------------------------------
ALTER TABLE test_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_normative_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_normative_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_categories_read" ON test_categories;
CREATE POLICY "test_categories_read" ON test_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "test_categories_master_write" ON test_categories;
CREATE POLICY "test_categories_master_write" ON test_categories FOR ALL
  USING (is_master()) WITH CHECK (is_master());

DROP POLICY IF EXISTS "test_instruments_read" ON test_instruments;
CREATE POLICY "test_instruments_read" ON test_instruments FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "test_instruments_master_write" ON test_instruments;
CREATE POLICY "test_instruments_master_write" ON test_instruments FOR ALL
  USING (is_master()) WITH CHECK (is_master());

DROP POLICY IF EXISTS "test_forms_read" ON test_forms;
CREATE POLICY "test_forms_read" ON test_forms FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "test_forms_master_write" ON test_forms;
CREATE POLICY "test_forms_master_write" ON test_forms FOR ALL
  USING (is_master()) WITH CHECK (is_master());

DROP POLICY IF EXISTS "test_normative_sets_read" ON test_normative_sets;
CREATE POLICY "test_normative_sets_read" ON test_normative_sets FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "test_normative_sets_master_write" ON test_normative_sets;
CREATE POLICY "test_normative_sets_master_write" ON test_normative_sets FOR ALL
  USING (is_master()) WITH CHECK (is_master());

DROP POLICY IF EXISTS "test_normative_tables_read" ON test_normative_tables;
CREATE POLICY "test_normative_tables_read" ON test_normative_tables FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "test_normative_tables_master_write" ON test_normative_tables;
CREATE POLICY "test_normative_tables_master_write" ON test_normative_tables FOR ALL
  USING (is_master()) WITH CHECK (is_master());

GRANT SELECT, INSERT, UPDATE, DELETE
  ON test_categories, test_instruments, test_forms,
     test_normative_sets, test_normative_tables
  TO authenticated;
GRANT SELECT ON test_catalog_view TO authenticated;

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_test_instruments_category
  ON test_instruments(category_code, sort_order);
CREATE INDEX IF NOT EXISTS idx_test_forms_instrument
  ON test_forms(instrument_code, sort_order);
CREATE INDEX IF NOT EXISTS idx_test_forms_status
  ON test_forms(implementation_status, active);
CREATE INDEX IF NOT EXISTS idx_test_normative_sets_form
  ON test_normative_sets(form_code, status);
CREATE INDEX IF NOT EXISTS idx_test_normative_tables_set
  ON test_normative_tables(normative_set_id);
CREATE INDEX IF NOT EXISTS idx_test_results_form
  ON test_results(test_form_code);
CREATE INDEX IF NOT EXISTS idx_test_results_normative_set
  ON test_results(normative_set_id);
