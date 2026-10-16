import { json } from '@sveltejs/kit';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';
import { env as envPublico } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

function cloudinaryConfigurado() {
	return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

async function uidDoToken(idToken: string): Promise<string | null> {
	const apiKey = envPublico.PUBLIC_FIREBASE_API_KEY;
	if (!apiKey) return null;

	const resposta = await fetch(
		`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken })
		}
	);

	if (!resposta.ok) return null;

	const dados = (await resposta.json()) as { users?: { localId?: string }[] };
	return dados.users?.[0]?.localId ?? null;
}

export const POST: RequestHandler = async ({ request }) => {
	if (!cloudinaryConfigurado()) {
		return json(
			{ erro: 'Cloudinary não configurado no servidor: defina CLOUDINARY_* no .env.' },
			{ status: 500 }
		);
	}

	const autorizacao = request.headers.get('authorization') ?? '';
	const idToken = autorizacao.startsWith('Bearer ') ? autorizacao.slice(7) : '';
	const uid = idToken ? await uidDoToken(idToken) : null;

	if (!uid) {
		return json({ erro: 'Entre na sua conta para anexar imagens.' }, { status: 401 });
	}

	const formulario = await request.formData();
	const arquivo = formulario.get('arquivo');

	if (!(arquivo instanceof File)) return json({ erro: 'Nenhum arquivo recebido.' }, { status: 400 });
	if (!arquivo.type.startsWith('image/')) {
		return json({ erro: 'O arquivo precisa ser uma imagem.' }, { status: 400 });
	}
	if (arquivo.size > TAMANHO_MAXIMO) {
		return json({ erro: 'A imagem passa de 5 MB.' }, { status: 400 });
	}

	cloudinary.config({
		cloud_name: env.CLOUDINARY_CLOUD_NAME,
		api_key: env.CLOUDINARY_API_KEY,
		api_secret: env.CLOUDINARY_API_SECRET
	});

	const base64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64');
	const enviado = await cloudinary.uploader.upload(`data:${arquivo.type};base64,${base64}`, {
		folder: `quiz/${uid}`,
		resource_type: 'image'
	});

	return json({ url: enviado.secure_url, publicId: enviado.public_id });
};
