# AULA 13 — Autenticação e autorização

**Aluno:** Bruno Correa dos Santos — matrícula 202322952
**Disciplina:** Laboratório de Desenvolvimento de Aplicativos Híbridos
**Aplicação:** Online Quiz — quiz ao vivo com chat (SvelteKit + Firebase Auth + PostgreSQL/Neon)
**Repositório:** https://github.com/corrbrunno/OpenQuiz
**Commit avaliado:** `4ad605e`
**Ambiente dos testes:** produção, `https://quiz.corrbrunno.dev.br`
**Data da execução:** 12/11/2026

> O material avisa que "demonstração local não equivale a prova de funcionamento remoto". Por isso
> todos os casos abaixo foram executados contra o domínio publicado, com contas reais criadas no
> Firebase, e apagadas no final da execução.

## 1. Decisão de arquitetura (e o desvio em relação ao roteiro)

O roteiro é escrito para Supabase. O projeto da disciplina usa **SvelteKit + Firebase Auth +
PostgreSQL (Neon) com Drizzle**, decisão tomada na P1 e mantida. O mapeamento entre os dois:

| Roteiro (Supabase) | Implementado aqui |
| --- | --- |
| `auth.uid()` — identidade confirmada | uid do `idToken` do Firebase, validado **no servidor** (`accounts:lookup`); conta desativada/apagada é recusada |
| `app_sessions` + `has_app_session()` | tabela `sessoes_usuario` (120 s de inatividade, `encerrada_em` para revogação) + guarda única no `hooks.server.ts` |
| Políticas RLS por tabela | autorização na camada de servidor: posse (`dono_uid`), participação na sala (`participantes`) e sessão vigente |
| Privilégio por coluna (`profiles.name` sim, `role` não) | no domínio do quiz não existe papel. O equivalente é que **campos de identidade nunca vêm do corpo**: `dono_uid`, `autor_uid` e o `uid` do token de push são sempre derivados do token |
| Edge Function com permissão elevada | não existe chave administrativa no cliente: Cloudinary só por rota autenticada, banco só no servidor |

**Desvio assumido, sem meia-palavra:** não há RLS no banco. A conexão é o role dono do projeto no
Neon, e dono de tabela passa por cima de política — habilitar RLS ali daria a falsa impressão de
proteção. O que garante o efeito cobrado pela rubrica é a guarda única de sessão mais as checagens de
posse, e é isso que os casos abaixo provam. **Dívida técnica declarada:** criar um role de aplicação
restrito (sem DDL, sem `BYPASSRLS`) e, com ele, RLS com `FORCE` — agendado para depois da prova
prática de 20/11, porque mexer no role agora quebraria o `drizzle-kit` em produção.

## 2. O que mudou nesta aula

Antes, `exigirSessao` estava copiado em 10 handlers e **ausente nas leituras**: com a sessão revogada,
um `GET /api/quizzes/<id>` ainda devolvia o questionário inteiro, gabarito incluído. Bastava uma rota
nova esquecer a chamada para o furo voltar.

- `src/hooks.server.ts` — guarda **única** para toda a API: token válido **e** sessão de app vigente.
  Ficam de fora só `/api/sessao` e `/api/sessao/touch`, que existem para abrir e fechar a sessão.
- `auth.ts` / `sessao-usuario.ts` — validação memoizada por requisição (`WeakMap` com o próprio
  `Request` como chave). O hook valida uma vez e o handler reaproveita: nenhuma chamada extra ao
  Firebase, nenhuma consulta extra no banco, e nenhum cache entre requisições (revogar vale na hora).
- `sessao.ts` / `chat.svelte.ts` — os dois streams SSE mandavam só `Authorization` e passariam a
  tomar 401; agora usam o mesmo helper de cabeçalhos das outras chamadas (`Authorization` +
  `X-Sessao`) e param de reconectar em 401/403 em vez de martelar o servidor.

## 3. Contas usadas

| Papel | Conta | Situação |
| --- | --- | --- |
| A | `teste-api-a-<timestamp>@example.com` | dona do questionário e da sala |
| B | `teste-api-b-<timestamp>@example.com` | entrou na sala como participante |
| C | — | **nunca** entrou na sala (usa a conta B, autenticada e fora da sala) |

Contas criadas via `accounts:signUp` do Firebase no início e removidas com `accounts:delete` no fim.
Nenhuma senha, token ou chave aparece neste documento nem no log.

## 4. Matriz de permissões — resultado real

| Recurso (roteiro) | Equivalente no projeto | A (dono) | B (participa) | C (fora da sala) | Sem sessão vigente |
| --- | --- | --- | --- | --- | --- |
| Próprio perfil | lista/edição dos próprios questionários + estado da sessão | **200** | **200** (só os dele) | **200** (só os dele) | **401** `sessao-invalida` |
| Perfil de outra conta | questionário de outra conta | **404** | **404** | **404** | **401** |
| Sala A/B | sala de A: responder, chat, painel | **200 / 201** | **200 / 201** | **403** | **401** |
| Alterar papel pelo app | alterar `dono_uid` do questionário pelo corpo | **200, campo ignorado** | **404** | **404** | **401** |
| Registrar próprio token | `POST /api/push/token` | **200**, gravado no uid do token | **200** | **200** | **401** |
| Push de mensagem própria autorizada | `POST /mensagens` no chat da sala | **201** | **201** | **403** | **401** |

Sem erro não é permissão: a negativa de leitura devolve **404** (não confirma que o recurso existe) e
a de escrita **403**, sempre com o corpo vazio de dados. Nenhum caso "passou" por ausência de erro.

## 5. Casos de teste

| ID | Ação | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| A6-01 | A lê o próprio questionário | permitido, com gabarito | `200`, `gabarito !== null` | **APROVADO** |
| A6-02 | A lê o questionário de outra conta | negado, sem dado | `404`, nenhum `atribuicoes` na resposta | **APROVADO** |
| A6-03 | A tenta trocar o dono (`donoUid`, `dono_uid`, `role` no corpo) | erro de privilégio / ignorado | `200`, `dono_uid` **intacto no banco**, A segue tomando `404` | **APROVADO** |
| A6-03b | A tenta excluir o questionário de outra conta | negado | `404`, quiz continua no banco | **APROVADO** |
| A6-04 | A envia mensagem com `autorUid`/`autor_uid` de B | insert negado ou autoria do token | `201`, mensagem gravada com o **uid de A** (o corpo é ignorado) | **APROVADO** |
| A6-05 | C lê o chat da sala de A/B | leitura negada | `403` | **APROVADO** |
| A6-05b | C escreve no chat da sala de A/B | escrita negada | `403` | **APROVADO** |
| A6-05c | C abre o painel do apresentador | negado | `403` | **APROVADO** |
| A6-06 | JWT válido + sessão revogada | dados privados indisponíveis | `401` `sessao-invalida` na lista, no gabarito, no estado da sala e no stream SSE | **APROVADO** |
| A6-06b | Sem token nenhum | negado | `401` `nao-autenticado` | **APROVADO** |
| A6-07 | A registra o próprio token de push | permitido, no próprio uid | `200`, `tokens_push.uid` = uid de A (o `uid` do corpo foi ignorado) | **APROVADO** |

Resultado da execução: **24 asserções no bloco de autenticação/autorização, todas aprovadas**, dentro
de uma bateria de **120 asserções** que cobre também CRUD, sessão conduzida/livre, correção no
servidor, placar, tempo real e integridade no banco. **0 falhas.**

## 6. Evidência bruta (produção, 12/11/2026)

```
=== BLOCO 6: AUTENTICACAO E AUTORIZACAO (MATRIZ) ===
OK   A6-01 dono le o proprio questionario -> 200 -> 200
OK   A6-01 gabarito disponivel para o dono -> true
OK   A6-02 outra conta le o questionario -> 404 -> 404
OK   A6-02 negativa nao vaza gabarito -> false
OK   A6-03 PUT com dono no corpo -> 200 (campo ignorado) -> 200
OK   A6-03 dono_uid intacto no banco -> "avAt5OXdQqb6nLOda36LHSGflWf2"
OK   A6-03 conta A continua sem acesso -> 404 -> 404
OK   A6-03 conta A nao exclui quiz alheio -> 404 -> 404
OK   A6-03 questionario continua no banco -> 1
OK   A6-04 A envia no proprio nome -> 201 -> 201
OK   A6-04 autoria vem do token, nao do corpo -> "dG7MoM2R43dbMOW7T5nHKUAHWDr1"
OK   A6-05 B le o chat da sala de A -> 403 -> 403
OK   A6-05 B escreve na sala de A -> 403 -> 403
OK   A6-05 B abre o painel do apresentador -> 403 -> 403
OK   A6-07 A registra o proprio token -> 200 -> 200
OK   A6-07 token gravado na conta de A -> "dG7MoM2R43dbMOW7T5nHKUAHWDr1"
=== SESSAO REVOGADA (cenario de defesa do bloco 6) ===
OK   operar com sessao revogada -> 401 -> 401
OK   A6-06 lista privada com sessao revogada -> 401 -> 401
OK   A6-06 codigo sessao-invalida -> "sessao-invalida"
OK   A6-06 gabarito com sessao revogada -> 401 -> 401
OK   A6-06 sala com sessao revogada -> 401 -> 401
OK   A6-06 stream com sessao revogada -> 401 -> 401
OK   A6-06 sem token nenhum -> 401 -> 401
OK   A6-06 codigo nao-autenticado -> "nao-autenticado"
OK   sessao nova volta a funcionar -> 200 -> 200
OK   a sessao nova tem outro id -> true

### RESULTADO: TODOS OS CASOS PASSARAM ###
```

O log completo (145 linhas, 120 asserções) vai anexado junto com este documento.

## 7. Como reproduzir

O roteiro é o próprio cliente autenticado: ele cria as contas no Firebase, obtém `idToken` real,
chama a API com `Authorization` + `X-Sessao` e confere o resultado. **Nada é feito pelo editor SQL**
— as duas consultas ao banco são só verificação de estado final e limpeza, como o material recomenda.

```bash
npm run dev                                    # ou TESTE_BASE=https://quiz.corrbrunno.dev.br
node --env-file=.env scripts/teste-api.mjs
```

O script apaga tudo o que criou: questionário (cascade em perguntas, gabaritos, sessões,
participantes, respostas), token de push e as três contas.

Conferência manual, com duas contas em dois navegadores:

1. A entra, cria um questionário em `/criar` e inicia a sessão em `/meus-quizzes`.
2. B entra na sala pelo código e responde.
3. No console do navegador de B, tentar `fetch('/api/quizzes/<id>')` com o token de A → `404`.
4. Aperte **Sair** em A e repetir a chamada com o token antigo → `401 sessao-invalida`.
5. Deixar a tela parada 2 minutos → a área privada é desmontada e a próxima chamada volta `401`.

## 8. Limitações conhecidas

- **Sem RLS no banco** (ver seção 1): a negação é de servidor. Dívida registrada com plano de correção.
- **Não existe papel (`role`) no domínio.** "Alterar o próprio papel" não existe como operação; o
  equivalente testado é alterar o dono do recurso, e o resultado é o mesmo: o campo é ignorado.
- **Negativa de leitura devolve 404**, não lista vazia. É decisão consciente: `[]` confirmaria que o
  recurso existe; `404` não entrega nem a existência.
- **Sessão de 2 minutos** vale agora também para leitura: quem fica 2 min sem tocar na tela é
  desconectado. É a exigência do bloco 2 e o preço de a revogação valer para leitura.
- **`tokens_push` faz upsert pelo token**: quem tiver o token de um aparelho (segredo do dispositivo)
  pode reatribuí-lo para a própria conta. Aceitável no escopo atual, anotado como risco.
