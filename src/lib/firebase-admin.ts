import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | undefined;

function normalizeConfigValue(value: string | undefined): string {
    const trimmed = value?.trim() ?? "";
    if (trimmed.length >= 2 && (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    )) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}

function normalizeStorageBucketName(value: string): string {
    let bucketName = normalizeConfigValue(value);

    if (/^gs:\/\//i.test(bucketName)) {
        bucketName = bucketName.slice(5);
    } else if (/^https?:\/\//i.test(bucketName)) {
        let url: URL;
        try {
            url = new URL(bucketName);
        } catch {
            throw new Error("Firebase Storage bucket configuration is invalid.");
        }

        const firebasePath = url.pathname.match(/^\/v0\/b\/([^/]+)(?:\/|$)/);
        if (url.hostname === "firebasestorage.googleapis.com" && firebasePath) {
            bucketName = decodeURIComponent(firebasePath[1]);
        } else if (url.hostname === "storage.googleapis.com") {
            bucketName = url.pathname.split("/").filter(Boolean)[0] ?? "";
        } else {
            throw new Error("Use a Firebase Storage bucket name or gs:// bucket URL.");
        }
    }

    bucketName = bucketName.replace(/\/+$/, "");
    if (!bucketName || /[/?#]/.test(bucketName)) {
        throw new Error("Firebase Storage bucket configuration is invalid.");
    }
    return bucketName;
}

function configuredStorageBucket(): string | undefined {
    const value = normalizeConfigValue(process.env.FIREBASE_STORAGE_BUCKET) ||
        normalizeConfigValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    if (!value) return undefined;

    try {
        return normalizeStorageBucketName(value);
    } catch {
        return undefined;
    }
}

function getAdminApp(): App {
    if (adminApp) return adminApp;

    const projectId = normalizeConfigValue(process.env.FIREBASE_PROJECT_ID) ||
        normalizeConfigValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    const clientEmail = normalizeConfigValue(process.env.FIREBASE_CLIENT_EMAIL);
    const rawPrivateKey = normalizeConfigValue(process.env.FIREBASE_PRIVATE_KEY);
    const privateKey = rawPrivateKey
        .replace(/\\\\r\\\\n/g, "\n")
        .replace(/\\\\n/g, "\n")
        .replace(/\\r?\\n/g, "\n")
        .replace(/\r\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Firebase Admin project ID, client email, and private key are required.");
    }

    const defaultApp = getApps().find((app) => app.name === "[DEFAULT]");
    if (defaultApp) {
        adminApp = defaultApp;
        return adminApp;
    }

    const storageBucket = configuredStorageBucket();
    adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        storageBucket: storageBucket ?? `${projectId}.firebasestorage.app`,
    });

    return adminApp;
}

export function getAdminAuth(): Auth {
    return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
    return getFirestore(getAdminApp());
}

export async function getAdminStorageBuckets() {
    const app = getAdminApp();
    const configuredValue = normalizeConfigValue(process.env.FIREBASE_STORAGE_BUCKET) ||
        normalizeConfigValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    const projectId = normalizeConfigValue(process.env.FIREBASE_PROJECT_ID) ||
        normalizeConfigValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) ||
        normalizeConfigValue(app.options.projectId);
    const bucketNames = new Set<string>();

    if (configuredValue) {
        try {
            bucketNames.add(normalizeStorageBucketName(configuredValue));
        } catch (error) {
            console.error("[firebase-admin] storage-bucket-configuration:", error);
        }
    }

    if (app.options.storageBucket) {
        bucketNames.add(normalizeStorageBucketName(app.options.storageBucket));
    }
    if (projectId) {
        bucketNames.add(`${projectId}.firebasestorage.app`);
        bucketNames.add(`${projectId}.appspot.com`);
    }
    if (!bucketNames.size) {
        throw new Error("Firebase Storage bucket is not configured.");
    }

    const { getStorage } = await import("firebase-admin/storage");
    const storage = getStorage(app);
    return [...bucketNames].map((bucketName) => storage.bucket(bucketName));
}
