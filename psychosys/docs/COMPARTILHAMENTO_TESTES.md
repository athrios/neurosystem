# Compartilhamento de testes por respondente

## Fluxo

1. Na avaliação, o profissional clica em **Compartilhar** no teste habilitado.
2. Informa o tipo, o nome e o vínculo do respondente.
3. O sistema cria um token exclusivo para aquela aplicação.
4. O respondente preenche uma pergunta por vez; o progresso é salvo.
5. Após o envio, surge **Revisar resposta** ao lado de **Compartilhar** na avaliação.
6. O profissional abre a resposta, confere os dados e calcula o resultado.

Quando existem várias respostas pendentes para o mesmo teste, o botão mostra a
quantidade e conduz o profissional para a próxima ainda não revisada.

Cada link é independente. Isso permite coletar respostas de mais de um informante
sem que um preenchimento público sobrescreva outro. A tabela `test_results`
continua sendo o resultado clínico consolidado da avaliação; somente a revisão
profissional grava ou substitui esse resultado.

## Segurança e rastreabilidade

- O link usa UUID aleatório e não exige autenticação do respondente.
- A identidade definida pelo profissional prevalece sobre qualquer conteúdo
  enviado pelo navegador.
- O formulário público não recebe o schema de pontuação.
- Links podem ser revogados.
- Respostas públicas ficam em `test_response_links`, com datas de criação,
  envio e revisão.
- Formulários em validação continuam identificados como não liberados para uso
  clínico.

## Habilitação por formulário

O botão depende de:

- `respondent_type` diferente de `professional` e `interview`;
- `implementation_status` igual a `testing` ou `active`;
- motor disponível no front-end;
- `metadata.public_response_enabled = true`.

No primeiro lote, **SNAP-IV** e **QEDP** estão habilitados porque possuem
enunciados completos na fonte importada. **SCARED** e **SDQ** continuam no modo
de transcrição: a planilha contém apenas a numeração dos itens e depende do
protocolo oficial externo.

## Migração

Executar no Supabase:

```text
migrations/20260702_shared_test_responses.sql
```
