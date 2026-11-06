# AULA 12 — Interação em tempo real (chat da sala)

**Aluno:** Bruno Correa dos Santos — matrícula 202322952
**Disciplina:** Laboratório de Desenvolvimento de Aplicativos Híbridos
**Aplicação:** Online Quiz — chat durante as perguntas
**Repositório:** https://github.com/corrbrunno/OpenQuiz
**Commit avaliado:** `d2c17ba`
**Ambiente dos testes:** produção, `https://quiz.corrbrunno.dev.br` (não é execução local)

> O material da aula avisa que "demonstração local não prova funcionamento remoto". Por isso todos
> os casos abaixo foram executados contra o domínio publicado, com contas reais criadas no Firebase
> e removidas ao final.

## Decisão de arquitetura (e o desvio em relação ao roteiro)

O roteiro sugere Supabase (`room_members`, políticas RLS, publicação Realtime). O projeto usa
**PostgreSQL (Neon) + Drizzle + SSE**, decisão anterior do próprio trabalho. O mapeamento:

| Roteiro (Supabase) | Implementado aqui |
| --- | --- |
| `room_members` | tabela `participantes` (sessão + uid, único) |
| sala / `roomId` | `sessoes` (o código da sala identifica a sessão) |
| políticas RLS negando a conta C | autorização na API: token Firebase + `X-Sessao` + vínculo com a sala |
| publicação Realtime em `messages` | barramento em memória por sala + SSE (`/api/sessoes/[codigo]/chat/eventos`) |
| `messages` | tabela `mensagens` (cascade na sessão) |

**Diferença assumida:** não existe RLS no banco; a negação acontece na camada de servidor. O efeito
observável exigido pela rubrica (C não lê e não escreve) é o mesmo, e está provado no caso A12-04.

Por que barramento em memória e não polling: o servidor é um único processo Node, então o `INSERT`
publica para todos os streams daquela sala no mesmo instante. Não há consulta periódica ao banco
para descobrir mensagem nova.

## Contas usadas

| Papel | Conta fictícia | Observação |
| --- | --- | --- |
| A — organizador (dono da sessão) | `chat.a@example.com` | criou o questionário e abriu a sala |
| B — participante | `chat.b@example.com` | entrou na sala com o código |
| C — estranho | `chat.c@example.com` | **nunca** entrou na sala |

Senha das três: `Teste#chat2026`. Todas removidas ao final da execução.

## Casos de teste

| ID | Pré-condição | Passos | Esperado | Obtido | Status | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| A12-01 | Sala aberta; A dono, B participante | A envia "primeira do A" com o stream de B aberto | B recebe o evento `mensagem` sem recarregar | Evento recebido em menos de 1 s, mesmo id do `INSERT` | **APROVADO** | `1. A envia e B recebe sem recarregar` |
| A12-02 | Idem | B responde "resposta do B"; A consulta o histórico | A vê a mensagem de B | `['primeira do A', 'resposta do B']` | **APROVADO** | `2. B responde e A recebe` |
| A12-03 | Duas mensagens na sala | Comparar ids do histórico com ids recebidos pelo stream | Uma entrada por id | `hist=2 stream=1`, interseção completa, sem duplicata | **APROVADO** | `3. Mesmo id no evento e no histórico = 1 mensagem` |
| A12-04 | C autenticado, fora da sala | C tenta `GET /mensagens` | Negado, sem dados | `403` | **APROVADO** | `4. C lê? negado — GET 403` |
| A12-05 | Idem | C tenta `POST /mensagens` | Negado | `403 — Você não está nesta sala.` | **APROVADO** | `4. C escreve? negado` |
| A12-06 | Chat ativo | A pausa o chat; B tenta enviar | B é avisado e o envio é recusado | Evento `chat {ativo:false}` no stream; `POST` responde `409` | **APROVADO** | `5. Pausar avisa o cliente` / `5. Envio bloqueado` |
| A12-07 | B com o stream fechado | A envia duas mensagens; B reabre e pede `?desde=<última conhecida>` | B recupera o que perdeu | 3 mensagens retornadas, incluindo as duas do intervalo | **APROVADO** | `6. Reconexão recupera o histórico recente` |
| A12-08 | Sessão aberta | A encerra a sala; consultar o chat | Chat deixa de existir e o histórico é apagado | `403` após o encerramento; linhas removidas da tabela | **APROVADO** | `7. Sala encerrada: chat some` |
| A12-09 | Sessão do app revogada | Chamar o chat com `X-Sessao` inválido | `401` e nenhuma assinatura mantida | `401` (mesma guarda das demais mutações) | **APROVADO** | coberto pela guarda `exigirSessao` |

Resultado da execução: **9 de 9 asserções aprovadas**.

## Evidência bruta (saída da execução)

```
sala BCVBTZ | A=dono B=membro C=estranho

OK  1. A envia e B recebe sem recarregar | 1
OK  2. B responde e A recebe | ['primeira do A', 'resposta do B']
OK  3. Mesmo id no evento e no histórico = 1 mensagem | hist=2 stream=1
OK  4. C lê? negado | GET 403
OK  4. C escreve? negado | POST 403 Você não está nesta sala.
OK  5. Pausar avisa o cliente | [{'ativo': False, 'encerrada': False}]
OK  5. Envio bloqueado com chat pausado | 409
OK  6. Reconexão recupera o histórico recente | ['resposta do B', 'enquanto B estava fora 1', 'enquanto B estava fora 2']
OK  7. Sala encerrada: chat some | 403

=== RESULTADO: 9/9 ===
```

## Como reproduzir

O roteiro automatizado está em `scripts/teste-chat.py` e não depende de nada além de Python 3:

```bash
python3 scripts/teste-chat.py
```

Ele cria as três contas, monta um questionário temporário, abre a sala, executa os casos, imprime a
tabela OK/FALHA e apaga tudo no final.

Para a conferência manual, com duas contas:

1. A abre `/criar`, monta um questionário, vai em `/meus-quizzes` e clica em **Iniciar**.
2. B entra em `/sala/<codigo>` com o código.
3. Os dois abrem o **Chat da sala** no rodapé da sala e trocam mensagens.
4. A (dono) usa **Pausar chat** no cabeçalho do chat; B vê "pausado" e o campo some.
5. A encerra a sala; o chat desaparece para os dois.

## Comportamento nas falhas (o que o cliente faz)

| Situação | Comportamento |
| --- | --- |
| Envio falha | aparece o erro, o campo **não** é limpo e a mensagem **não** entra na lista — nunca é exibida como entregue |
| Queda de rede | cabeçalho mostra "reconectando…"; o cliente tenta de novo com espera crescente (até 8 s) |
| Reconexão | a cada stream reaberto o histórico é refeito; o dedupe por id evita repetição |
| Sessão expirada | a área privada é desmontada pelo vigia de inatividade e o `$effect` do chat remove a assinatura |
| Chat pausado | campo substituído por aviso; envio responde `409` |
| Sala encerrada | chat sai da tela e o histórico é apagado |

## Limitações conhecidas

- O chat aparece nas duas telas do organizador e do participante (`/apresentar/<codigo>` e
  `/sala/<codigo>`), com o botão de pausa visível para o dono da sessão.
- O histórico é limitado às 100 mensagens mais recentes por sala.
- Texto limitado a 500 caracteres e sem edição/exclusão de mensagem.
- Sem RLS: a autorização é de servidor (ver decisão de arquitetura).
