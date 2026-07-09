# Exclusão de testes aplicados

## Comportamento atual

O profissional responsável pode excluir um teste aplicado enquanto a avaliação
estiver em andamento. A interface exige a senha de segurança do profissional.

A exclusão:

- remove o registro consolidado de `test_results`;
- revoga todos os links de resposta associados ao teste e à avaliação;
- preserva um snapshot completo do resultado em `test_deletion_audit`;
- registra usuário, proprietário, data, teste e quantidade de links revogados;
- não altera o catálogo nem as definições do teste.

O botão **Excluir** aparece tanto no resumo de testes aplicados quanto na linha
do teste no catálogo, incluindo os formulários de Comportamento e Sintomas.

## Senha temporária de teste

A migração configura a senha temporária `1234` para os perfis sem senha. O valor
é armazenado como hash bcrypt, nunca em texto puro no banco. Essa senha e o
gatilho que a distribui a novos perfis devem ser removidos antes da produção.

Após cinco tentativas incorretas, exclusão e restauração ficam bloqueadas por
15 minutos.

## Lixeira e restauração

O botão **Testes excluídos** abre um histórico pesquisável por nome, sigla ou
domínio. É possível filtrar resultados pendentes ou já restaurados.

A restauração exige novamente a senha e recompõe o registro original de
`test_results`, incluindo escores brutos, escores calculados, metadados, versão
do motor e referência normativa. Exclusões feitas antes desta versão continuam
visíveis no histórico, mas não podem ser restauradas porque não possuem
snapshot.

## Migração

Executar no Supabase:

```text
migrations/20260702_test_deletion_security.sql
migrations/20260706_test_result_recovery.sql
```
