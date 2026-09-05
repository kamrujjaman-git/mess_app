import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | undefined;

function getAdminApp(): App {
    if (adminApp) return adminApp;

    const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Firebase Admin credentials are not configured.");
    }

    adminApp = getApps()[0] ?? initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
    });

    return adminApp;
}

export function getAdminAuth(): Auth {
    return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
    return getFirestore(getAdminApp());
}
