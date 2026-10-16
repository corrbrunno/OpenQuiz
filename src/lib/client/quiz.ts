import { getFirebase } from './firebase';
import type { User } from 'firebase/auth';

export type PerguntaNova = {
	enunciado: string;
	alternativas: string[];
	correta: number;
	imagem: File | null;
};

export type PerguntaSalva = {
	id: string;
	ordem: number;
	enunciado: string;
	alternativas: string[];
	imagemUrl: string | null;
};

export type SalaCarregada = {
	id: string;
	titulo: string;
	codigo: string;
	totalPerguntas: number;
	perguntas: PerguntaSalva[];
};

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function gerarCodigo(tamanho = 6): string {
	const valores = new Uint32Array(tamanho);
	crypto.getRandomValues(valores);
	return Array.from(valores, (valor) => ALFABETO[valor % ALFABETO.length]).join('');
}

async function gerarCodigoLivre(): Promise<string> {
	const { db, firestoreMod: F } = await getFirebase();

	for (let tentativa = 0; tentativa < 5; tentativa++) {
		const codigo = gerarCodigo();
		const repetido = await F.getDocs(
			F.query(F.collection(db, 'quizzes'), F.where('codigo', '==', codigo), F.limit(1))
		);
		if (repetido.empty) return codigo;
	}

	throw new Error('Não foi possível reservar um código de sala livre. Tente salvar novamente.');
}

async function enviarImagem(arquivo: File, usuario: User): Promise<string> {
	const idToken = await usuario.getIdToken();
	const formulario = new FormData();
	formulario.append('arquivo', arquivo);

	const resposta = await fetch('/api/upload', {
		method: 'POST',
		headers: { Authorization: `Bearer ${idToken}` },
		body: formulario
	});

	const corpo = (await resposta.json().catch(() => ({}))) as { url?: string; erro?: string };
	if (!resposta.ok || !corpo.url) throw new Error(corpo.erro ?? 'Falha ao enviar a imagem.');

	return corpo.url;
}

export async function salvarQuestionario(
	titulo: string,
	perguntas: PerguntaNova[],
	usuario: User
): Promise<{ id: string; codigo: string }> {
	const { db, firestoreMod: F } = await getFirebase();
	const codigo = await gerarCodigoLivre();

	const quiz = await F.addDoc(F.collection(db, 'quizzes'), {
		titulo: titulo.trim(),
		codigo,
		donoUid: usuario.uid,
		donoEmail: usuario.email ?? null,
		totalPerguntas: perguntas.length,
		criadoEm: F.serverTimestamp()
	});

	for (const [indice, pergunta] of perguntas.entries()) {
		const ordem = indice + 1;
		const imagemUrl = pergunta.imagem ? await enviarImagem(pergunta.imagem, usuario) : null;

		const salva = await F.addDoc(F.collection(db, 'quizzes', quiz.id, 'perguntas'), {
			ordem,
			enunciado: pergunta.enunciado.trim(),
			alternativas: pergunta.alternativas.map((alternativa) => alternativa.trim()),
			imagemUrl
		});

		// O gabarito fica fora do documento da pergunta para não vazar para quem só joga.
		await F.setDoc(F.doc(db, 'gabaritos', salva.id), {
			quizId: quiz.id,
			donoUid: usuario.uid,
			correta: pergunta.correta
		});
	}

	return { id: quiz.id, codigo };
}

export async function buscarPorCodigo(codigoDigitado: string): Promise<SalaCarregada | null> {
	const { db, firestoreMod: F } = await getFirebase();
	const codigo = codigoDigitado.trim().toUpperCase();

	const encontrado = await F.getDocs(
		F.query(F.collection(db, 'quizzes'), F.where('codigo', '==', codigo), F.limit(1))
	);
	if (encontrado.empty) return null;

	const documento = encontrado.docs[0];
	const dados = documento.data();
	const perguntasSnap = await F.getDocs(
		F.query(F.collection(db, 'quizzes', documento.id, 'perguntas'), F.orderBy('ordem', 'asc'))
	);

	return {
		id: documento.id,
		titulo: String(dados.titulo ?? 'Sem título'),
		codigo: String(dados.codigo ?? codigo),
		totalPerguntas: Number(dados.totalPerguntas ?? perguntasSnap.size),
		perguntas: perguntasSnap.docs.map((item) => {
			const pergunta = item.data();
			return {
				id: item.id,
				ordem: Number(pergunta.ordem ?? 0),
				enunciado: String(pergunta.enunciado ?? ''),
				alternativas: Array.isArray(pergunta.alternativas) ? (pergunta.alternativas as string[]) : [],
				imagemUrl: pergunta.imagemUrl ? String(pergunta.imagemUrl) : null
			};
		})
	};
}

export function mensagemDeErro(erro: unknown): string {
	const codigo = (erro as { code?: string })?.code ?? '';
	const texto = erro instanceof Error ? erro.message : '';

	if (/has not been used in project|it is disabled/i.test(texto)) {
		return 'O Firestore está desativado neste projeto. Ative em console.firebase.google.com → Firestore Database → Criar banco de dados.';
	}

	switch (codigo) {
		case 'permission-denied':
			return 'O Firestore recusou a operação: publique as regras do arquivo firestore.rules no console.';
		case 'not-found':
			return 'O banco Firestore ainda não foi criado neste projeto (console → Firestore → Criar banco).';
		case 'unavailable':
			return 'Sem conexão com o Firestore: verifique a internet e se o banco foi criado no projeto.';
		default:
			return erro instanceof Error ? erro.message : 'Não foi possível concluir a operação.';
	}
}
