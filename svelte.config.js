import adapterAuto from '@sveltejs/adapter-auto';
import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// BUILD_ADAPTER=node -> servidor Node proprio (deploy no bruno-server).
// Padrao: adapter-auto (detecta Vercel/Netlify/Cloudflare no build).
const adapter = process.env.BUILD_ADAPTER === 'node' ? adapterNode({ out: 'build' }) : adapterAuto();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [vitePreprocess()],
	kit: {
		adapter
	}
};

export default config;
