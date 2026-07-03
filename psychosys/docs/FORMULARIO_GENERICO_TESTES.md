# Formulário genérico de testes

## Finalidade

O formulário genérico renderiza instrumentos simples e intermediários a partir
dos campos `administration_schema` e `scoring_schema` de `test_forms`.

Ele não substitui telas especializadas. Instrumentos complexos podem manter uma
rota e um motor próprios, como acontece com o WISC-IV.

## Contrato de administração — versão 1

```json
{
  "version": 1,
  "title": "Exemplo de formulário",
  "instructions": "Orientações exibidas ao profissional.",
  "sections": [
    {
      "id": "scores",
      "title": "Pontuações brutas",
      "description": "Preencha os valores observados.",
      "fields": [
        {
          "id": "measure_a",
          "type": "number",
          "label": "Medida A",
          "required": true,
          "min": 0,
          "max": 100,
          "step": 1,
          "span": 6
        },
        {
          "id": "notes",
          "type": "textarea",
          "label": "Observações",
          "span": 12
        }
      ]
    }
  ]
}
```

Tipos de campo permitidos:

- `number`
- `text`
- `textarea`
- `select`
- `radio`
- `checkbox`
- `date`
- `time`

Campos `select` e `radio` exigem `options`, no formato:

```json
[
  { "value": "1", "label": "Opção 1" },
  { "value": "2", "label": "Opção 2" }
]
```

`span` controla a largura do campo em uma grade de 12 colunas.

## Contrato de correção — versão 1

```json
{
  "version": 1,
  "outputs": [
    {
      "id": "total",
      "label": "Pontuação total",
      "operation": "sum",
      "fields": ["measure_a", "measure_b"],
      "decimals": 0,
      "classificationRanges": [
        { "max": 49, "label": "Faixa inferior" },
        { "min": 50, "label": "Faixa esperada" }
      ]
    }
  ]
}
```

Operações autorizadas:

- `sum`
- `average`
- `minimum`
- `maximum`
- `count_answered`
- `count_true`
- `difference`
- `ratio`
- `weighted_sum`

O backend nunca envia código JavaScript para execução. Apenas operações
previamente permitidas pelo motor `generic-v1` são aceitas.

## Ciclo de liberação

1. Cadastrar e revisar os schemas.
2. Definir `engine_key` como `generic-v1`.
3. Manter `implementation_status` como `modeling` durante a construção.
4. Alterar para `testing` durante a validação profissional.
5. Alterar para `active` somente após aprovação.

O status `testing` permite abertura com um aviso explícito de que o resultado
não deve ser utilizado clinicamente. Os status `catalogued` e `modeling`
continuam bloqueados. Somente após aprovação o formulário deve mudar para
`active`.

## Persistência

O formulário utiliza o contrato comum de `test_results`:

- `raw_scores`: respostas e pontuações informadas;
- `computed_scores`: resultados produzidos pelo motor;
- `result_status`: `draft` ou `scored`;
- `result_version`: versão da definição;
- `scoring_engine_version`: versão do motor utilizado;
- `test_form_code`: formulário catalogado.

Rascunhos podem estar incompletos. Para calcular, todos os campos obrigatórios
e dependências numéricas devem ser válidos.
