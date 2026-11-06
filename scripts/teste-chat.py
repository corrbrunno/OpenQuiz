
import json, re, threading, time, urllib.error, urllib.request

BASE = "https://quiz.corrbrunno.dev.br"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
SENHA = "Teste#chat2026"
ok = []

def pedir(url, metodo="GET", corpo=None, cab=None, limite=40):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    h = {"User-Agent": UA, **(cab or {})}
    if dados: h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=dados, method=metodo, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=limite) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try: return e.code, json.loads(t)
        except Exception: return e.code, {"raw": t[:160]}
    except Exception as e:
        return None, {"erro": str(e)}

def conferir(nome, condicao, detalhe=""):
    ok.append((nome, bool(condicao), detalhe))
    print(("OK   " if condicao else "FALHA") + " " + nome + (" | " + str(detalhe) if detalhe else ""))

req = urllib.request.Request(BASE + "/login", headers={"User-Agent": UA})
CHAVE = re.search(r'"PUBLIC_FIREBASE_API_KEY":"([^"]+)"', urllib.request.urlopen(req, timeout=30).read().decode()).group(1)

def conta(email):
    st, r = pedir(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={CHAVE}", "POST",
                  {"email": email, "password": SENHA, "returnSecureToken": True})
    if st == 400:
        st, r = pedir(f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={CHAVE}", "POST",
                      {"email": email, "password": SENHA, "returnSecureToken": True})
    return r.get("idToken"), r.get("localId")

def sessao_app(token):
    st, r = pedir(BASE + "/api/sessao", "POST", None, {"Authorization": "Bearer " + token})
    return r.get("sessao", {}).get("id") or r.get("id")

tok_a, uid_a = conta("chat.a@example.com")
tok_b, uid_b = conta("chat.b@example.com")
tok_c, uid_c = conta("chat.c@example.com")
sa, sb, sc = sessao_app(tok_a), sessao_app(tok_b), sessao_app(tok_c)
cab_a = {"Authorization": "Bearer " + tok_a, "X-Sessao": sa}
cab_b = {"Authorization": "Bearer " + tok_b, "X-Sessao": sb}
cab_c = {"Authorization": "Bearer " + tok_c, "X-Sessao": sc}

pergunta = {"enunciado": "2+2?", "tipo": "multipla-escolha",
            "conteudo": {"tipo": "multipla-escolha", "opcoes": [{"id": "a", "texto": "4"}, {"id": "b", "texto": "5"}], "permiteMultiplas": False},
            "gabarito": {"tipo": "multipla-escolha", "atribuicoes": [{"itemId": "a", "alvoId": "escolhida"}]}}
st, r = pedir(BASE + "/api/quizzes", "POST", {"titulo": "Chat teste (temporario)", "perguntas": [pergunta]}, cab_a)
quiz_id = r.get("id")
st, r = pedir(BASE + "/api/sessoes", "POST", {"quizId": quiz_id, "modo": "conduzida"}, cab_a)
codigo = r.get("sessao", {}).get("codigo")
pedir(BASE + f"/api/sessoes/{codigo}/entrar", "POST", {}, cab_b)
print(f"\nsala {codigo} | A=dono B=membro C=estranho\n")

eventos = {"b": []}
def ouvir(chave, token, parar):
    url = BASE + f"/api/sessoes/{codigo}/chat/eventos"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Authorization": "Bearer " + token})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            nome = "message"
            for linha in r:
                if parar.is_set(): break
                t = linha.decode().strip()
                if t.startswith("event:"): nome = t[6:].strip()
                elif t.startswith("data:"):
                    try: eventos[chave].append((nome, json.loads(t[5:].strip())))
                    except Exception: pass
    except Exception: pass

parar_b = threading.Event()
th = threading.Thread(target=ouvir, args=("b", tok_b, parar_b), daemon=True)
th.start(); time.sleep(2)

# 1) A envia -> B recebe ao vivo
pedir(BASE + f"/api/sessoes/{codigo}/mensagens", "POST", {"texto": "primeira do A"}, cab_a)
time.sleep(2)
msgs_b = [d for (e, d) in eventos["b"] if e == "mensagem"]
conferir("1. A envia e B recebe sem recarregar", any(m.get("texto") == "primeira do A" for m in msgs_b), len(msgs_b))

# 2) B responde -> aparece no histórico do A
pedir(BASE + f"/api/sessoes/{codigo}/mensagens", "POST", {"texto": "resposta do B"}, cab_b)
time.sleep(1)
st, hist_a = pedir(BASE + f"/api/sessoes/{codigo}/mensagens", None, cab=cab_a)
textos = [m["texto"] for m in hist_a.get("mensagens", [])]
conferir("2. B responde e A recebe", "resposta do B" in textos, textos)

# 3) dedupe por id
ids = [m["id"] for m in hist_a.get("mensagens", [])]
ids_stream = [m["id"] for m in msgs_b]
conferir("3. Mesmo id no evento e no histórico = 1 mensagem",
         len(ids) == len(set(ids)) and set(ids) & set(ids_stream) == set(ids_stream), f"hist={len(ids)} stream={len(ids_stream)}")

# 4) C sem acesso
st_get, r_get = pedir(BASE + f"/api/sessoes/{codigo}/mensagens", None, cab=cab_c)
st_post, r_post = pedir(BASE + f"/api/sessoes/{codigo}/mensagens", "POST", {"texto": "invasor"}, cab_c)
conferir("4. C lê? negado", st_get == 403, f"GET {st_get}")
conferir("4. C escreve? negado", st_post == 403, f"POST {st_post} {r_post.get('erro','')[:40]}")

# 5) pausar o chat
pedir(BASE + f"/api/sessoes/{codigo}/controle", "POST", {"acao": "chat", "ativo": False}, cab_a)
time.sleep(2)
eventos_chat = [d for (e, d) in eventos["b"] if e == "chat"]
st_p, r_p = pedir(BASE + f"/api/sessoes/{codigo}/mensagens", "POST", {"texto": "com chat pausado"}, cab_b)
conferir("5. Pausar avisa o cliente", any(d.get("ativo") is False for d in eventos_chat), eventos_chat[-1:] )
conferir("5. Envio bloqueado com chat pausado", st_p == 409, st_p)
pedir(BASE + f"/api/sessoes/{codigo}/controle", "POST", {"acao": "chat", "ativo": True}, cab_a)

# 6) reconexão recupera o que passou
parar_b.set(); time.sleep(1)
pedir(BASE + f"/api/sessoes/{codigo}/mensagens", "POST", {"texto": "enquanto B estava fora 1"}, cab_a)
pedir(BASE + f"/api/sessoes/{codigo}/mensagens", "POST", {"texto": "enquanto B estava fora 2"}, cab_a)
ultimo = ids[-1]
st, depois = pedir(BASE + f"/api/sessoes/{codigo}/mensagens?desde=" + urllib.parse.quote(
    [m for m in hist_a["mensagens"] if m["id"] == ultimo][0]["criadoEm"]), None, cab=cab_b)
recuperadas = [m["texto"] for m in depois.get("mensagens", [])]
conferir("6. Reconexão recupera o histórico recente",
         "enquanto B estava fora 1" in recuperadas and "enquanto B estava fora 2" in recuperadas, recuperadas)

# 7) encerrar apaga o chat
pedir(BASE + f"/api/sessoes/{codigo}/controle", "POST", {"acao": "encerrar"}, cab_a)
st_f, _ = pedir(BASE + f"/api/sessoes/{codigo}/mensagens", None, cab=cab_a)
conferir("7. Sala encerrada: chat some", st_f == 403, st_f)

# limpeza
st, _ = pedir(BASE + f"/api/quizzes/{quiz_id}", "DELETE", None, cab_a)
for t in (tok_a, tok_b, tok_c):
    if t: pedir(f"https://identitytoolkit.googleapis.com/v1/accounts:delete?key={CHAVE}", "POST", {"idToken": t})
print("\nlimpeza: quiz", st)

total = len(ok); passou = sum(1 for _, c, _ in ok if c)
print(f"\n=== RESULTADO: {passou}/{total} ===")
for nome, c, d in ok:
    if not c: print("  FALHOU:", nome, d)
