# Validação do lote 01 — SCARED, SDQ, SNAP-IV e QEDP

## Situação

Os quatro formulários são instalados com `implementation_status = testing`.
Eles podem ser abertos para conferência, mas exibem a advertência:

> Formulário em validação. Não utilize este resultado para finalidade clínica.

Nenhum deles deve ser promovido para `active` antes da aprovação profissional.

## Origem das regras

As perguntas, agrupamentos, médias, desvios-padrão, inversões e pontos de corte
foram transcritos das seguintes abas da planilha PsychoSys 3.7.2d:

- `SCARED` e `SCARED-Normas`;
- `SDQ-Pr`;
- `SNAP-IV`;
- `QEDP`.

O SCARED utiliza também a referência normativa registrada na própria planilha:
Isolan et al., *Journal of Anxiety Disorders*, 25 (2011), 741–748.

## Escopo desta validação

Cada aplicação registra um respondente. Nome e tipo do respondente ficam
armazenados com as respostas. Para comparar vários informantes, devem ser
criadas avaliações separadas nesta primeira versão.

SCARED e SDQ exibem os itens pela numeração do protocolo porque a planilha de
origem também pressupõe a transcrição de um questionário externo. SNAP-IV e
QEDP exibem os textos presentes na planilha.

## Casos de conferência

### SCARED

- Preencher todos os 41 itens com `0`: total esperado `0`, classificação
  `Não clínico`.
- Preencher todos os itens com `1`: total esperado `41`, classificação
  `Clínico`.
- Em autoaplicação, paciente feminino de 9 a 11 anos: confirmar que os detalhes
  normativos utilizam a coluna Criança/Feminino.

### SDQ

- Preencher todos os 25 itens como `Falso`.
- Resultado esperado: Conduta `2`, Hiperatividade `4`, Colegas `4`,
  Total `10`.
- Classificação esperada do Total: `Normal`.
- Classificação esperada de Colegas: `Limítrofe`.
- A diferença decorre da inversão dos itens 7, 11, 14, 21 e 25.

### SNAP-IV

- Todas as respostas `Nada`: subescalas com pontuação `0` e classificação
  `Não clínico`.
- Todas as respostas `Bastante`: Desatenção `18`, Hiperatividade `18` e
  Comportamento desafiador `16`.
- Classificações esperadas: `Desatento`, `Hiperativo` e `Clínico`.
- Indicador qualitativo de impulsividade esperado: `Sugestivo`.

### QEDP

- Preencher os 32 itens com `3`.
- Todos os sete fatores e os três estilos devem apresentar valor bruto `3`.
- Conferir a presença de Z-score, ponto ponderado, percentil e classificação
  normativa nos detalhes.

## Checklist manual

- Conferir textos, acentuação e ordem dos itens.
- Conferir responsividade e navegação por teclado.
- Salvar rascunho, sair e abrir novamente.
- Calcular e confirmar os valores dos casos acima.
- Confirmar que a avaliação concluída abre em modo somente leitura.
- Confirmar que o pré-laudo não apresenta esses resultados como validados.
- Registrar divergências com instrumento, item, resposta e resultado esperado.

## Migração

Executar no SQL Editor do Supabase:

```text
migrations/20260702_four_tests_validation.sql
```
