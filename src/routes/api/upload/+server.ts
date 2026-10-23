import { json } from '@sveltejs/kit';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { exigirSessao } from '$lib/server/sessao-usuario';
import type { RequestHandler } from './$types';

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

function cloudinaryConfigurado() {
	return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

export const POST: RequestHandler = async ({ request }) => {
	if (!cloudinaryConfigurado()) {
		return json(
			{ erro: 'Cloudinary não configurado no servidor: defina CLOUDINARY_* no .env.' },
			{ status: 500 }
		);
	}

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) {
		return json({ erro: 'Entre na sua conta para anexar imagens.' }, { status: 401 });
	}

	const semSessao = await exigirSessao(request, usuario);
	if (semSessao) return semSessao;

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
		folder: `quiz/${usuario.uid}`,
		resource_type: 'image'
	});

	return json({ url: enviado.secure_url, publicId: enviado.public_id });
};
