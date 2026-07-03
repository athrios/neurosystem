# PsychoSys / NeuroSystem — Sistema de Avaliação Neuropsicológica

Sistema web multiusuário para apoio à avaliação psicológica e neuropsicológica, com foco em cadastro de pacientes, registro de avaliações, correção automatizada de testes e futura geração de relatórios profissionais.

O projeto é baseado inicialmente na planilha **PsychoSys v3.7.2d**, com evolução planejada para uma aplicação web profissional e escalável no modelo SaaS.

---

## 1. Objetivo do projeto

O PsychoSys / NeuroSystem tem como objetivo centralizar e automatizar etapas do processo de avaliação neuropsicológica, reduzindo retrabalho manual, aumentando a padronização dos cálculos e oferecendo maior segurança no armazenamento das informações.

Nesta fase inicial, o sistema contempla:

* Cadastro de pacientes
* Cadastro e controle de avaliações
* Correção automatizada do WISC-IV
* Autenticação de usuários
* Controle de acesso por perfil
* Row Level Security no banco de dados
* Armazenamento estruturado dos resultados
* Base para expansão futura com novos testes
* Preparação para geração de relatórios em PDF

---

## 2. Stack

* **Frontend**: React 18 + Vite
* **Backend/DB**: Supabase — PostgreSQL + Auth + RLS
* **Gráficos**: Recharts
* **Ícones**: Lucide React

---

## 3. Configuração do Supabase

### 3.1 Criar projeto no Supabase

Acesse [supabase.com](https://supabase.com) e crie um novo projeto.

### 3.2 Rodar o schema

No **SQL Editor** do Supabase, execute o conteúdo do arquivo:

```bash
schema.sql
```

### 3.3 Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com as chaves do Supabase disponíveis em:

```text
Settings > API
```

> Atenção: o arquivo `.env` não deve ser versionado no repositório. Chaves, tokens e service keys devem permanecer fora do GitHub.

### 3.4 Criar usuário Master

No Supabase, acesse:

```text
Authentication > Users
```

Crie um usuário e, em seguida, no SQL Editor, execute:

```sql
UPDATE profiles
SET role = 'master'
WHERE email = 'seu@email.com';
```

### 3.5 Seed dos dados normativos do WISC-IV

```bash
# Adicione SUPABASE_SERVICE_KEY no .env
# Coloque wisc_iv_normas.json na raiz do projeto
node seed_wisc_normas.js
```

> Nota: o arquivo `wisc_iv_normas.json` é gerado pelo script Python de extração da planilha.

---

## 4. Desenvolvimento local

Instale as dependências:

```bash
npm install
```

Execute o ambiente de desenvolvimento:

```bash
npm run dev
```

Acesse:

```text
http://localhost:5173
```

---

## 5. Estrutura atual do projeto

```text
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
│   │   ├── WiscIV.jsx      # Formulário WISC-IV completo
│   │   └── ProfilePage.jsx
│   └── components/
│       └── Layout.jsx
```

---

## 6. Funcionalidades implementadas — Fase 1

### 6.1 Autenticação e usuários

* [x] Login com e-mail e senha via Supabase Auth
* [x] Perfil de psicólogo
* [x] Campos profissionais: CRP, CPF, RG e endereço
* [x] Perfil Master
* [x] Master visualiza todos os pacientes e avaliações
* [x] RLS para que cada psicólogo visualize apenas seus próprios dados

### 6.2 Pacientes

* [x] Cadastro de pacientes
* [x] Campos principais: nome, data de nascimento, sexo, escolaridade, série e instituição
* [x] Listagem de pacientes com busca
* [x] Página de detalhe do paciente
* [x] Histórico de avaliações por paciente
* [x] Exclusão de paciente com confirmação

### 6.3 Avaliações

* [x] Criação de sessões de avaliação por paciente
* [x] Controle de status da avaliação
* [x] Status disponíveis: em andamento e concluída
* [x] Listagem dos testes por categoria
* [x] Catálogo dinâmico com 46 instrumentos e 56 formulários
* [x] Formulário genérico versionado para instrumentos simples e intermediários
* [x] Motor declarativo seguro, sem execução de código armazenado no banco
* [x] SCARED, SDQ, SNAP-IV e QEDP preparados em modo de validação

### 6.4 WISC-IV

* [x] Implementação do primeiro teste completo
* [x] 15 subtestes
* [x] 10 subtestes principais
* [x] 5 subtestes suplementares
* [x] Dados normativos para 33 faixas etárias, de 6:0 a 16:11
* [x] Cálculo automático de pontos ponderados
* [x] Cálculo de Z-score
* [x] Cálculo de percentil
* [x] Classificação dos resultados
* [x] Cálculo dos 4 índices principais:

  * ICV
  * IOP
  * IMO
  * IVP
* [x] Cálculo do QI Total
* [x] Verificação de interpretabilidade dos índices
* [x] Gráfico de radar do perfil cognitivo
* [x] Salvamento e recuperação dos resultados

---

## 7. Classificação utilizada

Sistema baseado em **Guilmette et al. (2020)** — American Academy of Clinical Neuropsychology.

|   Faixa | Classificação  |
| ------: | -------------- |
|   ≥ 130 | Muito Superior |
| 120–129 | Superior       |
| 110–119 | Média Superior |
|  90–109 | Média          |
|   80–89 | Média Inferior |
|   70–79 | Limítrofe      |
|    < 70 | Deficitário    |

---

## 8. Segurança e controle de acesso

O projeto utiliza Supabase Auth e Row Level Security para controle de acesso aos dados.

Diretrizes atuais:

* Usuários autenticados acessam o sistema via Supabase Auth
* Psicólogos devem visualizar apenas seus próprios pacientes e avaliações
* Usuário Master pode visualizar todos os pacientes e avaliações
* Regras de acesso são aplicadas por RLS no banco de dados
* Dados sensíveis não devem ser expostos indevidamente no front-end
* Chaves de ambiente não devem ser versionadas no repositório

Status: implementado parcialmente, com necessidade de documentação técnica detalhada em arquivo próprio.

Documento previsto:

```text
docs/04-seguranca-e-rls.md
```

---

## 9. Banco de dados

O banco de dados utiliza PostgreSQL via Supabase.

Arquivo principal atual:

```text
schema.sql
```

Estruturas já citadas no projeto:

* Perfis de usuários
* Pacientes
* Avaliações
* Resultados do WISC-IV
* Dados normativos do WISC-IV
* Controle de papéis de usuário
* Políticas de RLS

Status: schema existente, pendente de documentação detalhada.

Documento previsto:

```text
docs/03-banco-de-dados.md
```

---

## 10. Motor WISC-IV

O motor de cálculo do WISC-IV está localizado em:

```text
src/lib/wisc-engine.js
```

Responsabilidades do motor:

* Processar dados brutos dos subtestes
* Consultar dados normativos
* Calcular pontos ponderados
* Calcular índices
* Calcular QI Total
* Calcular Z-score e percentil
* Classificar resultados
* Verificar interpretabilidade dos índices

Status: implementado na Fase 1, pendente de documentação técnica específica.

Documento previsto:

```text
docs/05-motor-wisc-iv.md
```

---

## 11. Próximas fases

### Fase 2 — Testes Cognitivos

* WAIS-III
* WASI
* RAVLT
* HVLT-R
* BVMT-R
* Trilhas
* STROOP
* D2-R

### Fase 3 — Testes Comportamentais

* CBCL
* SCARED
* SNAP-IV
* SRS-2, em 3 versões
* ABAS-3
* Vineland-3

### Fase 4 — Relatórios

* Protocolo Geral com exportação em PDF
* Gráficos de perfil completos
* Módulo de recibos
* Relatórios profissionais para uso clínico

---

## 12. Documentação técnica prevista

A documentação do projeto poderá ser organizada nos seguintes arquivos:

```text
README.md
CHANGELOG.md
ROADMAP.md
docs/01-visao-geral.md
docs/02-arquitetura.md
docs/03-banco-de-dados.md
docs/04-seguranca-e-rls.md
docs/05-motor-wisc-iv.md
docs/06-fluxo-de-avaliacao.md
docs/07-lgpd.md
docs/08-decisoes-tecnicas.md
docs/09-diario-de-desenvolvimento.md
docs/10-pendencias.md
migrations/README.md
```

---

## 13. Pendências documentais

* [ ] Criar `CHANGELOG.md`
* [ ] Criar `ROADMAP.md`
* [ ] Criar `docs/01-visao-geral.md`
* [ ] Criar `docs/02-arquitetura.md`
* [ ] Criar `docs/03-banco-de-dados.md`
* [ ] Criar `docs/04-seguranca-e-rls.md`
* [ ] Criar `docs/05-motor-wisc-iv.md`
* [ ] Criar `docs/06-fluxo-de-avaliacao.md`
* [ ] Criar `docs/07-lgpd.md`
* [ ] Criar `docs/08-decisoes-tecnicas.md`
* [ ] Criar `docs/09-diario-de-desenvolvimento.md`
* [ ] Criar `docs/10-pendencias.md`
* [ ] Criar `migrations/README.md`

---

## 14. Observações

Este documento representa a documentação inicial consolidada do projeto PsychoSys / NeuroSystem.

Informações técnicas ainda não detalhadas devem ser registradas como pendentes até validação ou implementação correspondente.

---

## 15. Compartilhamento de testes

Testes destinados a paciente, responsável, professor ou informante podem gerar
links individuais por respondente. O preenchimento público utiliza uma pergunta
por etapa, salvamento automático e revisão profissional antes da consolidação do
resultado.

Detalhes: `docs/COMPARTILHAMENTO_TESTES.md`.
