# PsychoSys — Sistema de Avaliação Neuropsicológica

Sistema web multi-usuário para correção automatizada de testes psicológicos e neuropsicológicos, baseado na planilha PsychoSys v3.7.2d.

## Stack

- **Frontend**: React 18 + Vite
- **Backend/DB**: Supabase (PostgreSQL + Auth + RLS)
- **Gráficos**: Recharts
- **Ícones**: Lucide React

---

## Configuração do Supabase

### 1. Criar projeto no Supabase
Acesse [supabase.com](https://supabase.com) e crie um novo projeto.

### 2. Rodar o schema
No **SQL Editor** do Supabase, execute o conteúdo do arquivo `schema.sql`.

### 3. Configurar variáveis de ambiente
```bash
cp .env.example .env
```
Edite `.env` com suas chaves do Supabase (Settings > API).

### 4. Criar usuário Master
No Supabase > Authentication > Users, crie um usuário. Depois, no SQL Editor, execute:
```sql
UPDATE profiles
SET role = 'master'
WHERE email = 'seu@email.com';
```

### 5. Seed dos dados normativos do WISC-IV
```bash
# Adicione SUPABASE_SERVICE_KEY no .env
# Coloque wisc_iv_normas.json na raiz do projeto
node seed_wisc_normas.js
```
> **Nota**: O arquivo `wisc_iv_normas.json` é gerado pelo script Python de extração da planilha.

---

## Desenvolvimento

```bash
npm install
npm run dev
```

Acesse [http://localhost:5173](http://localhost:5173)

---

## Estrutura

```
psychosys/
├── schema.sql              # Schema completo do banco
├── seed_wisc_normas.js     # Seed dos dados normativos
├── wisc_iv_normas.json     # Dados normativos extraídos (gerado)
├── src/
│   ├── App.jsx             # Roteamento + AuthContext
│   ├── lib/
│   │   ├── supabase.js     # Client + helpers de BD
│   │   └── wisc-engine.js  # Motor de cálculo WISC-IV
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Patients.jsx
│   │   ├── PatientDetail.jsx
│   │   ├── EvaluationDetail.jsx
│   │   ├── WiscIV.jsx      # ← Formulário WISC-IV completo
│   │   └── ProfilePage.jsx
│   └── components/
│       └── Layout.jsx
```

---

## Funcionalidades Implementadas (Fase 1)

### Auth & Usuários
- [x] Login com e-mail e senha (Supabase Auth)
- [x] Perfil de psicólogo (CRP, CPF, RG, endereço)
- [x] Acesso Master: visualiza todos os pacientes e avaliações
- [x] RLS: cada psicólogo vê apenas seus dados

### Pacientes
- [x] Cadastro (nome, DOB, sexo, escolaridade, série, instituição)
- [x] Listagem com busca
- [x] Detalhe com histórico de avaliações
- [x] Exclusão com confirmação

### Avaliações
- [x] Criação de sessões de avaliação por paciente
- [x] Status: em andamento / concluída
- [x] Listagem dos testes por categoria

### WISC-IV ← Primeiro teste completo
- [x] 15 subtestes (10 principais + 5 suplementares)
- [x] Dados normativos para 33 faixas etárias (6:0 a 16:11)
- [x] Cálculo automático: pontos ponderados, Z-score, percentil, classificação
- [x] 4 índices (ICV, IOP, IMO, IVP) + QI Total
- [x] Verificação de interpretabilidade dos índices
- [x] Gráfico de radar do perfil cognitivo
- [x] Salvar e recuperar resultados

---

## Próximas Fases

### Fase 2 — Testes Cognitivos
- WAIS-III, WASI
- RAVLT, HVLT-R, BVMT-R
- Trilhas, STROOP, D2-R

### Fase 3 — Testes Comportamentais
- CBCL, SCARED, SNAP-IV
- SRS-2 (3 versões)
- ABAS-3, Vineland-3

### Fase 4 — Relatórios
- Protocolo Geral (exportação PDF)
- Gráficos de perfil completos
- Módulo de recibos

---

## Classificação utilizada

Sistema baseado em **Guilmette et al. (2020)** — American Academy of Clinical Neuropsychology:
- ≥ 130 → Muito Superior
- 120–129 → Superior
- 110–119 → Média Superior
- 90–109 → Média
- 80–89 → Média Inferior
- 70–79 → Limítrofe
- < 70 → Deficitário
