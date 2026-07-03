# Exclusão de testes aplicados

## Comportamento atual

O profissional responsável pode excluir um teste aplicado enquanto a avaliação
estiver em andamento. A interface exige uma confirmação explícita.

A exclusão:

- remove o registro consolidado de `test_results`;
- revoga todos os links de resposta associados ao teste e à avaliação;
- registra usuário, proprietário, data, teste e quantidade de links revogados
  em `test_deletion_audit`;
- não altera o catálogo nem as definições do teste.

A operação passa exclusivamente pela função `delete_applied_test`. Não existe
política de exclusão direta em `test_results`, portanto o controle futuro de
senha não poderá ser contornado pela API comum.

## Estrutura preparada para senha

`professional_security_settings` possui configuração individual por
profissional, incluindo:

- hash da senha de exclusão;
- indicador de ativação;
- versão e data da senha;
- tentativas malsucedidas e bloqueio temporário.

Nesta fase não existe cadastro, campo de senha ou validação criptográfica.
`test_deletion_password_enabled` permanece `false`. Se for habilitado
manualmente, a exclusão é bloqueada preventivamente até a implementação da
validação.

## Migração

Executar no Supabase:

```text
migrations/20260702_test_deletion_security.sql
```

