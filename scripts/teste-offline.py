"""Teste automatizado do offline do Online Quiz (produção).

Verifica, num Chromium real:
  1. o service worker registra e ativa;
  2. os assets do app e o HTML inicial entram no CacheStorage;
  3. com a rede desligada, o app AINDA abre (shell servido do cache);
  4. uma rota nunca visitada cai numa cópia utilizável, não na tela de erro do Chromium;
  5. `/api/*` NÃO é servido do cache (a chamada falha, não mente);
  6. voltando a rede, o app continua funcionando.
"""
import sys

from playwright.sync_api import sync_playwright

URL = 'https://quiz.corrbrunno.dev.br/'
resultados = []

# O app não define <title> (achado do teste): a prova de "UI carregada" é a navbar real.
MARCADOR = 'document.querySelector(\'[aria-label="Navegação principal"]\') !== null'


def confere(rotulo, obtido, esperado):
    ok = obtido == esperado
    resultados.append(ok)
    print(('OK   ' if ok else 'FALHA') + f' {rotulo} -> {obtido!r} (esperado {esperado!r})')


def tem_shell(pagina):
    try:
        return bool(pagina.evaluate(MARCADOR))
    except Exception:  # noqa: BLE001
        return False


with sync_playwright() as p:
    navegador = p.chromium.launch(args=['--no-sandbox'])
    contexto = navegador.new_context(
        viewport={'width': 390, 'height': 844},
        user_agent=(
            'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
        ),
    )
    pagina = contexto.new_page()

    print('== 1. ONLINE: carrega e registra o service worker ==')
    pagina.goto(URL, wait_until='networkidle', timeout=90000)
    pagina.wait_for_timeout(2500)

    estado = pagina.evaluate(
        """async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            const chaves = await caches.keys();
            const detalhe = {};
            for (const k of chaves) detalhe[k] = (await (await caches.open(k)).keys()).length;
            const paginas = chaves.filter((k) => k.startsWith('oq-paginas'));
            let temInicio = false;
            for (const k of paginas) {
                const c = await caches.open(k);
                if (await c.match('/')) temInicio = true;
            }
            return {
                registrado: !!reg,
                ativo: reg && reg.active ? reg.active.state : null,
                controlado: !!navigator.serviceWorker.controller,
                script: reg && reg.active ? reg.active.scriptURL : '',
                caches: detalhe,
                temInicio
            };
        }"""
    )
    print('   detalhe:', estado)
    confere('service worker registrado', estado['registrado'], True)
    confere('service worker ativo', estado['ativo'], 'activated')
    confere('app controlado pelo SW', estado['controlado'], True)
    confere('script versionado na URL', '?v=' in estado['script'], True)
    confere('HTML inicial guardado no cache', estado['temInicio'], True)
    total_assets = sum(v for k, v in estado['caches'].items() if k.startswith('oq-app'))
    confere('assets no cache (>20)', total_assets > 20, True)
    confere('shell online renderiza', tem_shell(pagina), True)

    print('== 2. OFFLINE: recarrega sem rede ==')
    contexto.set_offline(True)
    try:
        resposta = pagina.reload(wait_until='domcontentloaded', timeout=45000)
        status = resposta.status if resposta else None
    except Exception as erro:  # noqa: BLE001
        status = f'erro: {erro}'
    pagina.wait_for_timeout(2500)

    corpo = pagina.inner_text('body')[:220].replace('\n', ' | ')
    print('   status:', status)
    print('   corpo :', corpo)

    confere('status da navegacao offline', status, 200)
    confere('shell do app renderiza offline', tem_shell(pagina), True)
    confere('nao e a tela de sem conexao', 'Sem conexão' in corpo, False)
    confere('conteudo real (>50 chars)', len(corpo) > 50, True)

    print('== 3. OFFLINE: rota nunca visitada ==')
    try:
        pagina.goto(URL + 'criar', wait_until='domcontentloaded', timeout=30000)
        pagina.wait_for_timeout(1500)
        corpo_rota = pagina.inner_text('body')[:120].replace('\n', ' | ')
    except Exception as erro:  # noqa: BLE001
        corpo_rota = f'erro: {erro}'
    print('   corpo :', corpo_rota)
    confere('rota nova nao quebra o app', tem_shell(pagina), True)

    print('== 4. OFFLINE: API nao vem do cache ==')
    api = pagina.evaluate(
        """async () => {
            try {
                const r = await fetch('/api/quizzes');
                return 'respondeu ' + r.status;
            } catch (e) {
                return 'falhou (correto)';
            }
        }"""
    )
    print('   /api/quizzes offline ->', api)
    confere('API falha offline em vez de servir cache', api.startswith('falhou'), True)

    print('== 5. ONLINE de novo ==')
    contexto.set_offline(False)
    voltou = False
    for tentativa in range(3):
        try:
            pagina.goto(URL, wait_until='domcontentloaded', timeout=45000)
            pagina.wait_for_timeout(1500)
            voltou = tem_shell(pagina)
            if voltou:
                break
        except Exception as erro:  # noqa: BLE001
            print(f'   tentativa {tentativa + 1} falhou: {erro}')
            pagina.wait_for_timeout(2000)
    confere('volta a carregar online', voltou, True)

    contexto.close()
    navegador.close()

print()
if all(resultados):
    print(f'### RESULTADO: TODOS OS {len(resultados)} CASOS PASSARAM ###')
    sys.exit(0)
print(f'### RESULTADO: {resultados.count(False)} DE {len(resultados)} CASOS FALHARAM ###')
sys.exit(1)
