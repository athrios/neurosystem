# Correção de pontos críticos identificados na revisão de 2026-07-02

Documento de referência para o desenvolvedor implementar. Nenhuma alteração de
código foi feita a partir desta revisão — apenas o levantamento abaixo.

Prioridade: **P0** (item 1, dado de saúde exposto) e **P1** (item 2, controle
de acesso incompleto).

---

## 1. Dado de saúde real exposto no histórico do Git (P0)

### Problema

O commit `eebc709` (2026-07-02 00:44) adicionou `psychosys/tmp/pdfs/relatorio-01.jpg`
até `relatorio-21.jpg`. Pelo menos o arquivo `relatorio-01.jpg` é a foto de um
**laudo real de avaliação neuropsicológica**, contendo nome completo do
paciente, data de nascimento, profissão, hipótese diagnóstica e histórico
familiar psiquiátrico. Os demais 20 arquivos seguem o mesmo padrão de nome e
precisam da mesma checagem.

O `.gitignore` criado nesse mesmo commit cobre `node_modules/`, `dist/` e
`.env*`, mas **não cobre `tmp/`** — por isso os arquivos entraram no
versionamento. O repositório tem remote configurado
(`https://github.com/athrios/neurosystem.git`), então, se já houve `git push`
dessa branch, o material também está no GitHub.

### Impacto

Dado de saúde identificável (PHI) versionado permanentemente em um sistema de
controle de versão é uma violação de princípio de minimização de dados e um
risco direto de conformidade com a LGPD (dado sensível de saúde, Art. 5º, II).
Remover o arquivo em um commit novo **não resolve** — ele continua acessível
via `git log`/`git show` em qualquer clone existente e no histórico remoto.

### Correção necessária

1. **Adicionar `tmp/` ao `.gitignore`** de `psychosys/` (hoje a pasta não está
   coberta; foi o que permitiu o commit acidental).
2. **Purgar o histórico do Git** para os 21 arquivos em
   `psychosys/tmp/pdfs/` — usar `git filter-repo` (preferível) ou BFG
   Repo-Cleaner, reescrevendo o histórico de todas as branches locais e
   remotas que contenham o commit `eebc709` ou seus descendentes.
3. Se a branch já foi enviada ao GitHub: após reescrever o histórico local,
   fazer `push --force` da branch afetada e, por segurança, tratar o
   conteúdo como potencialmente comprometido — avaliar rotação de qualquer
   credencial que estivesse no repositório na mesma janela de tempo (mesmo
   não tendo sido encontrada nenhuma neste caso) e confirmar com o GitHub
   Support a invalidação de caches/forks se o repositório já foi clonado por
   terceiros.
4. Confirmar com quem gerou os `.jpg` (aparentam ser capturas de tela de PDFs
   de laudo) se eram necessários versionados; se sim, mover para
   armazenamento fora do Git (bucket privado do Supabase Storage, por
   exemplo) com controle de acesso, nunca para o repositório de código.
5. Auditar o restante do histórico (`git log --all --diff-filter=A --name-only`)
   procurando por outros arquivos de paciente reais que possam ter entrado
   por engano em commits anteriores ou futuros.

### Critério de aceite

- `tmp/` presente no `.gitignore` de `psychosys/`.
- Nenhuma referência aos 21 arquivos em `git log --all -- psychosys/tmp/pdfs`
  após a limpeza de histórico.
- Branch remota atualizada refletindo o histórico limpo.

---

## 2. Link de compartilhamento de teste sem expiração aplicada (P1)

### Problema

A tabela `test_response_links` (migração
`20260702_shared_test_responses.sql`) tem a coluna `expires_at`, e a função
`get_shared_test_response` já valida `expires_at IS NULL OR expires_at > NOW()`.
Porém, nenhum ponto do código cria um link preenchendo `expires_at` — nem
`create_test_response_link` (SQL) nem `TestShareDialog.jsx` (frontend) passam
essa data. Na prática, todo link público gerado hoje fica válido
indefinidamente até ser revogado manualmente.

### Impacto

Um link enviado a um respondente externo (pai, professor, paciente) continua
ativo mesmo muito tempo depois de a avaliação ter sido concluída ou
abandonada, ampliando a janela em que o token (UUID) pode ser usado por
qualquer pessoa que o obtenha.

### Correção necessária

1. Definir uma expiração padrão razoável (ex.: 14 ou 30 dias — a decidir com
   o responsável de produto) e aplicá-la em `create_test_response_link`,
   preenchendo `expires_at` no `INSERT`.
2. Alternativamente/complementarmente, expor no `TestShareDialog.jsx` um
   campo para o profissional escolher a validade do link no momento da
   criação, respeitando um teto máximo definido no backend.
3. Job ou trigger periódico (ex.: `pg_cron` ou verificação sob demanda) para
   marcar como `expired` os links cujo `expires_at` já passou, mantendo o
   campo `status` consistente com a regra já usada em
   `get_shared_test_response`.

### Critério de aceite

- Todo novo registro em `test_response_links` sai do `create_test_response_link`
  com `expires_at` preenchido (ou com escolha explícita do profissional,
  nunca `NULL` por omissão).
- Um link expirado retorna erro/indisponibilidade ao ser acessado
  (`get_shared_test_response` já cobre isso — só falta garantir que
  `expires_at` sempre exista).

---

## Fora de escopo deste documento

Os demais achados “menores” do relatório de 2026-07-02 (arquivo de lock do
Word commitado, `ABAS-3`/`BDEFS` ausentes do catálogo,
`documentação.txt` sem padronização de nome) não têm risco de segurança ou
compliance e podem ser tratados como limpeza de rotina, sem prioridade P0/P1.
