# Online Quiz

Quiz ao vivo para sala de aula, no estilo Kahoot/Wayground: o professor cria o questionário,
abre a sala, projeta o painel e conduz as perguntas; os alunos entram com um código pelo
navegador ou pelo aplicativo Android.

O mesmo código roda nos dois lugares — o aplicativo é um shell Capacitor que carrega a
aplicação web, então a regra de negócio e a interface são únicas.

- **Código-fonte:** https://github.com/corrbrunno/OpenQuiz (branch `master`)
- **Aplicação publicada:** https://quiz.corrbrunno.dev.br
- **Pacote instalável:** `app-debug.apk` (build em *Aplicativo Android*, abaixo)

## Stack

| Camada | Escolha |
| --- | --- |
| Front-end | SvelteKit 2 + Svelte 5 (runes), TypeScript, Vite 6 |
| Estilo | Tailwind CSS 4 + shadcn-svelte (bits-ui) |
| Autenticação | Firebase Auth (e-mail/senha e Google) |
| Dados | PostgreSQL (Neon) com Drizzle ORM + `postgres-js` |
| Imagens | Cloudinary (upload assinado no servidor) |
| Tempo real | SSE (`EventSource` sobre `fetch`, com token no cabeçalho) |
| Aplicativo | Capacitor 8 (Android), biometria e push via FCM |

## Requisitos

- Node.js 22 ou superior
- PostgreSQL acessível (Neon, Supabase, local — qualquer instância com SSL)
- Projeto Firebase com o provedor **E-mail/senha** ativo (Google é opcional)
- Conta Cloudinary (upload de imagem nas perguntas)
- Para gerar o APK: JDK 21 e Android SDK com `platforms;android-36` e `build-tools;36.0.0`

Capacitor 8 exige **JDK 21**; JDK 17 não compila o módulo Android.

## Como rodar

```bash
npm install
cp .env.example .env      # preencha as variáveis (veja abaixo)
npm run db:push           # cria as tabelas no banco
npm run dev               # http://localhost:5174
```

Scripts disponíveis:

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento em `0.0.0.0:5174` |
| `npm run build` | build de produção (SSR) |
| `npm run preview` | serve o build |
| `npm run check` | `svelte-kit sync` + `svelte-check` |
| `npm run test:logica` | testes da lógica de perguntas e correção (sem banco) |
| `npm run test:api` | testes ponta a ponta da API (exige `npm run dev` e banco) |
| `npm run lint` / `npm run format` | Prettier + ESLint |
| `npm run db:push` / `npm run db:studio` | aplica o schema / abre o Drizzle Studio |

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | conexão usada pela aplicação (use a **pooled** em produção) |
| `DATABASE_URL_UNPOOLED` | conexão direta, apenas para `drizzle-kit` |
| `DATABASE_URL_POOLED` | alternativa nomeada da conexão pooled |
| `PUBLIC_FIREBASE_*` | credenciais públicas do app Web no Firebase |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | upload de imagens |
| `FCM_CHAVE_BASE64` | conta de serviço do Firebase em base64, para o push (opcional) |
| `ORIGIN` / `PUBLIC_APP_URL` | origem pública do app (proteção CSRF do SvelteKit) |
| `BUILD_ADAPTER` | `node` para gerar build de servidor (Docker); vazio usa `adapter-auto` |

Sem `FCM_CHAVE_BASE64` o envio de push fica inerte — útil em desenvolvimento, onde não há
aparelho registrado.

## Como a rodada funciona

1. O professor cria o questionário em `/criar` (uma pergunta por vez, com imagem opcional).
2. Em `/meus-quizzes` escolhe o questionário e abre a sessão; **o código da sala só nasce aí**.
3. O painel `/apresentar/<codigo>` mostra a pergunta no ar, quem já respondeu e o placar.
4. Os alunos entram em `/sala/<codigo>` com o código.
5. O professor avança, volta ou encerra. No modo **conduzida** todos veem a mesma pergunta; no
   modo **livre** cada um responde no próprio ritmo.

O gabarito nunca vai para o navegador: fica em uma tabela separada e a correção acontece no
servidor. O cliente envia apenas `{ perguntaId, atribuicoes }` e recebe de volta acertos e total.

## Tipos de pergunta

Cinco tipos compartilham o mesmo formato de resposta (`Atribuicao[]`, item → alvo), o que
permite uma única função de correção:

- múltipla escolha (uma ou várias corretas)
- verdadeiro ou falso
- categorizar (cada item em uma categoria)
- reordenar (devolver a ordem correta)
- tabela de correspondência (coluna A ↔ coluna B)

O acerto é parcial por item: quem acerta 3 de 5 recebe 3/5.

## Sessão do aplicativo

Independente da sessão do Firebase, o app mantém uma sessão própria no servidor
(`sessoes_usuario`): nasce no login, é renovada pela atividade do usuário e expira por
inatividade. Toda mutação exige o cabeçalho `X-Sessao`; sessão expirada ou revogada responde
`401` e a área privada é desmontada na hora.

Acompanham esse desenho: identificação da conta em `/perfil`, bloqueio de conta desativada no
Firebase e renovação por atividade (`pointerdown`, `keydown`, `scroll`, `visibilitychange`).

## Entrada nativa (biometria)

No aplicativo Android, a conta pode exigir a confirmação do sistema (digital, rosto ou o
PIN/padrão do aparelho) antes de liberar a área privada.

- a preferência é **por conta e por aparelho**, guardada só no dispositivo — nenhuma senha é armazenada
- o portão roda no login **e** na restauração da sessão (quando o app reabre, o Firebase devolve
  o usuário sem passar por senha)
- cancelar mantém a tela privada fechada e devolve o usuário à tela de entrada
- aparelho sem biometria e sem PIN/padrão não tranca ninguém fora: entra por senha, com aviso
- no navegador o recurso é inerte, então o mesmo bundle serve web e aplicativo

## Notificações (push)

Quando o organizador libera uma pergunta no modo conduzida, quem está na sala mas **fora do
aplicativo** recebe uma notificação; tocar nela abre a sala direto na pergunta nova.

- o token do aparelho é registrado em `tokens_push` e removido quando o FCM o considera inválido
- o app informa se está na frente (`participantes.em_app`); sem sinal por 60 s também conta como ausente
- o envio usa a API HTTP v1 do FCM assinando um JWT com a conta de serviço, sem Admin SDK

## API

| Rota | Descrição |
| --- | --- |
| `POST /api/quizzes` · `GET /api/quizzes` | criar e listar questionários do usuário |
| `GET` · `PUT` · `DELETE /api/quizzes/[id]` | carregar (sem gabarito), editar e excluir |
| `POST /api/sessoes` | abrir sessão e gerar o código da sala |
| `GET /api/sessoes/[codigo]` | estado da sala |
| `POST /api/sessoes/[codigo]/entrar` | entrar como participante (idempotente) |
| `POST /api/sessoes/[codigo]/respostas` | responder (corrigido no servidor) |
| `POST /api/sessoes/[codigo]/controle` | avançar, voltar ou encerrar (só o dono) |
| `GET /api/sessoes/[codigo]/eventos` | stream SSE com o estado da sala |
| `POST /api/sessoes/[codigo]/presenca` | avisar se o app está na frente ou em segundo plano |
| `POST` · `DELETE /api/push/token` | registrar e remover o token de push do aparelho |
| `POST` · `GET` · `DELETE /api/sessao` | abrir, consultar e encerrar a sessão do app |
| `POST /api/sessao/touch` | renovar a sessão por atividade |
| `POST /api/upload` | upload assinado no Cloudinary |

### Endereço da API publicada

A API é servida pelo próprio app publicado, na mesma origem — não existe servidor separado:

| Ambiente | Base |
|---|---|
| Produção | `https://quiz.corrbrunno.dev.br/api/` |
| Desenvolvimento | `http://localhost:5174/api/` (`npm run dev`) |

Exemplo: `GET https://quiz.corrbrunno.dev.br/api/quizzes` sem cabeçalho de autenticação responde
**401** — a guarda de sessão roda antes de qualquer handler.

### Comprovação de persistência em banco em nuvem

Os dados **não ficam em memória**: toda leitura e escrita vai para um PostgreSQL gerenciado em nuvem
(Neon), apontado por `DATABASE_URL`. Como comprovar em três passos, sem depender de acesso ao painel:

1. autentique e crie um questionário (`POST /api/quizzes`) — a resposta devolve o `id`;
2. consulte com `GET /api/quizzes` e recarregue a página: o questionário continua lá;
3. reinicie o container (`docker compose restart`) e repita o `GET` — o registro sobrevive, porque veio
   do banco, não do processo.

Para inspecionar as linhas gravadas: `npm run db:studio` (Drizzle Studio) com a mesma `DATABASE_URL`, ou
`psql "$DATABASE_URL" -c "select id, titulo, dono_uid from quizzes"`.

A escrita é idempotente onde importa: `respostas` tem chave única `(sessao, pergunta, participante)` e a
rota grava com `ON CONFLICT DO NOTHING` — reenviar a mesma resposta devolve `jaRespondida: true` e não
cria segunda linha.

## Modelo de dados

`quizzes` → `perguntas` → `gabaritos` (um por pergunta, nunca exposto ao cliente)
`quizzes` → `sessoes` (código, modo, pergunta no ar) → `participantes` → `respostas`
Auxiliares: `sessoes_usuario` (sessão do app) e `tokens_push` (um por aparelho).

Todas as relações usam `ON DELETE CASCADE`: excluir o questionário limpa perguntas, gabaritos,
sessões, participantes e respostas.

## Perfis de teste

O sistema tem dois papéis, definidos pela **posse do recurso** (não existe coluna `role` no banco:
o papel é derivado de `quizzes.dono_uid`, e a autorização é feita no servidor, não na tela).

| Perfil | Como entra | O que pode |
|---|---|---|
| **Apresentador (dono)** | cria o questionário e inicia a sessão | conduz a sessão (avançar/encerrar),
vê painel e ranking; é o único que passa nas rotas `/api/sessoes/<codigo>/controle*` |
| **Participante** | entra pelo código de 6 caracteres | responde as perguntas e usa o chat da sala;
recebe 403 no painel de controle e na sala de quem não é dono nem participante |

Contas de demonstração (criadas só para a avaliação, sem dado real):

| Conta | Senha |
|---|---|
| `professor.p2@example.com` | `P2Hibridos#2026` |
| `aluno.p2@example.com` | `P2Hibridos#2026` |

Fluxo mínimo com dois aparelhos: entrar como professor → criar quiz → iniciar sessão (o código de 6
caracteres aparece no painel) → no segundo aparelho entrar como aluno com esse código → responder.

## Roteiro dos cenários (A–E)

Cada cenário é reproduzível em ~2 min no app publicado.

**A — Fluxo completo.** Professor cria o quiz, inicia a sessão e obtém o código. Aluno entra com o
código e responde. Recarregue a página do aluno: a resposta continua lá (persistida no PostgreSQL em
nuvem, não em memória). O painel do professor conta 1 respondido e o ranking aparece ao encerrar.

**B — Segurança.** (1) *Sem sessão*: `curl -s -o /dev/null -w '%{http_code}'`
em `https://quiz.corrbrunno.dev.br/api/quizzes` → **401**. (2) *Perfil incompatível*: logado como aluno,
`GET /api/sessoes/<codigo>/controle` → **403** ("Só quem criou o questionário controla a sessão").
(3) *Sessão revogada*: sair em outro aparelho e repetir `GET /api/quizzes` com o token antigo → **401**
com `codigo: "sessao-invalida"`.

**C — Recurso nativo.** No APK: Perfil → ativar a confirmação pelo sistema. Ao reabrir o app, o diálogo
de biometria/PIN do Android aparece antes da área privada. Cancelar mantém a área fechada; a preferência
é por conta e por aparelho e nenhuma senha é armazenada. A validação local **não** substitui a do
servidor — sem token válido e sessão vigente a API continua devolvendo 401.

**D — Falha de rede.** Aluno na sala, com a pergunta no ar → ativar modo avião → responder. A tela mostra
"Resposta guardada no aparelho" e "1 resposta(s) aguardando envio"; a fila fica em `localStorage`
(`fila-offline:<uid>`) contendo apenas o payload (sala, pergunta, alternativas) — nunca token ou sessão.
Ao religar a rede a fila esvazia sozinha (~2,5 s), aparece "1 resposta(s) sincronizada(s) com o servidor"
e o banco fica com **uma** linha. Reenviar o mesmo payload devolve `jaRespondida: true` sem criar
segunda linha.

**E — Resiliência.** *Entrada inválida*: `POST /api/sessoes` sem `quizId` → **400** com mensagem legível.
*Sessão expirada*: ficar 2 min sem interagir e responder → o app avisa e pede login novamente, sem
desmontar a tela à força (e a fila de respostas offline sobrevive à expiração). *Serviço fora*: com a API
indisponível a interface cai no estado offline/erro em vez de encerrar.

## Testes

- `npm run test:logica` — 25 casos: montagem de gabarito e resposta dos cinco tipos, correção
  com acerto parcial, resposta em branco e validação de payload.
- `npm run test:api` — 120 asserções contra a API real: criação e edição de questionário, sessão
  conduzida com dois jogadores, sessão livre, `401/403/404/409/400`, garantia de que o gabarito
  não vaza, reenvio idempotente, ordem do placar, sessão do app (expiração, revogação, `touch`),
  stream SSE e limpeza por cascata.

Os testes criam contas e questionários temporários e os removem no final.

## Aplicativo Android

```bash
npm install
npx cap sync android          # copia os plugins e a configuração para o projeto nativo
cd android && ./gradlew assembleDebug   # Windows: gradlew.bat assembleDebug
```

O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`.

A arquitetura atual é de **shell**: o WebView carrega a aplicação publicada
(`server.url` em `capacitor.config.ts`) — hoje **https://quiz.corrbrunno.dev.br**. Isso mantém API,
sessão e SSE no servidor Node e evita
duplicar regra de negócio. Para uma versão autônoma, use `adapter-static` acionado por variável
de ambiente, aponte `PUBLIC_API_BASE` para o backend e remova o bloco `server`.

O endereço carregado pode ser trocado sem editar o arquivo:

```bash
CAPACITOR_SERVER_URL=https://seu-dominio.example npx cap sync android
```

Em rede local, rode `npm run dev -- --host` e use o IP da máquina no lugar do domínio.

`android/app/google-services.json` é necessário para o push e corresponde ao app Android
registrado no Firebase. Para compilar sem push, remova o plugin `google-services` de
`android/app/build.gradle`.

## Deploy

Os arquivos de container estão em `deploy/`: `Dockerfile`, `docker-compose.yml` e `.dockerignore`.
O build usa `BUILD_ADAPTER=node` (adapter-node do SvelteKit); sem essa variável o
`svelte.config.js` permanece em `adapter-auto`.

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

O container serve a aplicação em `3000` e espera as variáveis de ambiente listadas acima. Em
produção, publique atrás de um proxy reverso com HTTPS e defina `ORIGIN` com a URL pública —
sem isso o SvelteKit rejeita mutações por proteção CSRF.

## Estrutura

```
src/lib/quiz/                  domínio das perguntas: tipos, rascunhos, correção, validação, utilidades
src/lib/components/quiz/       editores e respondedores, um por tipo de pergunta
src/lib/components/ui/         componentes shadcn-svelte usados na interface
src/lib/client/                cliente: API, sessão, SSE, som, acessibilidade, entrada nativa e push
src/lib/server/db/             conexão e schema Drizzle
src/lib/server/                autenticação, sessões, sala e envio de push
src/routes/api/                endpoints HTTP
src/routes/                    telas: início, login, criar, meus questionários, sala, painel, perfil
scripts/                       testes de lógica e de API
deploy/                        Dockerfile e compose de produção
android/                       projeto nativo gerado pelo Capacitor
```

## Acessibilidade

A barra superior oferece escala de fonte, tema claro/escuro e um painel de Libras; a escala
escolhida é aplicada já no primeiro carregamento, antes da hidratação. A interface usa
componentes com foco visível, rótulos e navegação por teclado, e o layout se adapta a telas
estreitas sem rolagem horizontal.
