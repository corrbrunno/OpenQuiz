import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

export const firebaseConfig = {
	apiKey: env.PUBLIC_FIREBASE_API_KEY,
	authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: env.PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: env.PUBLIC_FIREBASE_APP_ID
};

export function firebaseConfigurado(): boolean {
	return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

type FirebaseBundle = {
	auth: import('firebase/auth').Auth;
	db: import('firebase/firestore').Firestore;
	authMod: typeof import('firebase/auth');
	firestoreMod: typeof import('firebase/firestore');
};

let bundle: Promise<FirebaseBundle> | null = null;

export function getFirebase(): Promise<FirebaseBundle> {
	if (!browser) throw new Error('O Firebase só é inicializado no navegador');
	if (!firebaseConfigurado()) {
		throw new Error('Firebase não configurado: preencha as variáveis PUBLIC_FIREBASE_* no .env');
	}

	if (!bundle) {
		bundle = (async () => {
			const [appMod, authMod, firestoreMod] = await Promise.all([
				import('firebase/app'),
				import('firebase/auth'),
				import('firebase/firestore')
			]);

			const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);

			return {
				auth: authMod.getAuth(app),
				db: firestoreMod.getFirestore(app),
				authMod,
				firestoreMod
			};
		})();
	}

	return bundle;
}
