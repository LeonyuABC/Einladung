import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
    browserLocalPersistence,
    getAuth,
    setPersistence,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { CONFIG } from "../config.js";

const COLLECTIONS = ["invitations", "plans", "diaryEntries", "wishlistItems", "moods", "notifications"];

let firebaseApp = null;
let auth = null;
let db = null;
let anonymousSignInPromise = null;
let unsubscribeCollections = [];

function containsPlaceholder(value) {
    return typeof value !== "string" || !value.trim() || value.includes("_HERE");
}

export function isCloudConfigured() {
    const firebaseValues = Object.values(CONFIG.firebase || {});
    return firebaseValues.length >= 4
        && firebaseValues.every((value) => !containsPlaceholder(value))
        && typeof CONFIG.coupleId === "string"
        && Boolean(CONFIG.coupleId.trim());
}

export async function initializeCloud() {
    if (!isCloudConfigured()) throw new Error("FIREBASE_NOT_CONFIGURED");
    if (firebaseApp) return;
    firebaseApp = initializeApp(CONFIG.firebase);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
    await setPersistence(auth, browserLocalPersistence);
}

// Firebase erstellt pro Browser im Hintergrund ein anonymes Konto. Es gibt
// weder Registrierungsformular noch E-Mail. Die anonyme Sitzung bleibt durch
// browserLocalPersistence auch nach einem Neuladen erhalten.
export async function ensureAnonymousUser() {
    if (!auth) throw new Error("CLOUD_NOT_INITIALIZED");
    if (typeof auth.authStateReady === "function") await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser;
    if (!anonymousSignInPromise) {
        anonymousSignInPromise = signInAnonymously(auth)
            .then((credential) => credential.user)
            .finally(() => { anonymousSignInPromise = null; });
    }
    return anonymousSignInPromise;
}

function dispatchSyncStatus(status, message = "") {
    window.dispatchEvent(new CustomEvent("couple-space-sync-status", {
        detail: { status, message }
    }));
}

function cloudCollection(name) {
    return collection(db, "couples", CONFIG.coupleId, name);
}

export function startRealtimeSync(onCollectionChanged) {
    if (!db || !auth?.currentUser) throw new Error("NOT_AUTHENTICATED");
    stopRealtimeSync();
    dispatchSyncStatus("connecting");
    const ready = new Set();

    unsubscribeCollections = COLLECTIONS.map((name) => onSnapshot(
        cloudCollection(name),
        (snapshot) => {
            const items = snapshot.docs.map((item) => item.data());
            onCollectionChanged(name, items);
            ready.add(name);
            if (ready.size === COLLECTIONS.length) dispatchSyncStatus("connected");
        },
        (error) => {
            console.error(`Firebase-Synchronisation für ${name} fehlgeschlagen.`, error);
            dispatchSyncStatus("error", "Synchronisation fehlgeschlagen");
        }
    ));
}

export function stopRealtimeSync() {
    unsubscribeCollections.forEach((unsubscribe) => unsubscribe());
    unsubscribeCollections = [];
}

function documentId(id) {
    return encodeURIComponent(String(id)).slice(0, 1400);
}

function recordReference(collectionName, id) {
    return doc(db, "couples", CONFIG.coupleId, collectionName, documentId(id));
}

function cloneForCloud(value) {
    if (value === undefined) return null;
    const clean = JSON.parse(JSON.stringify(value));
    delete clean.shareMode;
    delete clean.cloudUpdatedAt;
    return clean;
}

function deepEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function mapById(items) {
    return new Map((Array.isArray(items) ? items : []).map((item) => [item.id, item]));
}

function buildPatch(before, after) {
    const patch = {};
    const nestedMaps = new Set(["reactions", "suggestions", "responses", "contributions"]);
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    keys.delete("id");
    keys.delete("shareMode");
    keys.delete("cloudUpdatedAt");

    for (const key of keys) {
        const oldValue = before?.[key];
        const newValue = after?.[key];
        if (deepEqual(oldValue, newValue)) continue;
        if (nestedMaps.has(key) && oldValue && newValue && typeof oldValue === "object" && typeof newValue === "object") {
            const nestedKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
            nestedKeys.forEach((nestedKey) => {
                if (!deepEqual(oldValue[nestedKey], newValue[nestedKey])) {
                    patch[`${key}.${nestedKey}`] = cloneForCloud(newValue[nestedKey]);
                }
            });
        } else {
            patch[key] = cloneForCloud(newValue);
        }
    }
    patch.cloudUpdatedAt = serverTimestamp();
    return patch;
}

async function syncCollectionDiff(name, beforeItems, afterItems) {
    const before = mapById(beforeItems);
    const after = mapById(afterItems);
    const operations = [];

    for (const [id, oldItem] of before) {
        if (!after.has(id)) operations.push(deleteDoc(recordReference(name, id)));
        else if (!deepEqual(oldItem, after.get(id))) {
            const newItem = after.get(id);
            const reference = recordReference(name, id);
            const patch = buildPatch(oldItem, newItem);
            operations.push(updateDoc(reference, patch).catch(() => setDoc(reference, {
                ...cloneForCloud(newItem),
                cloudUpdatedAt: serverTimestamp()
            })));
        }
    }
    for (const [id, newItem] of after) {
        if (!before.has(id)) {
            operations.push(setDoc(recordReference(name, id), {
                ...cloneForCloud(newItem),
                cloudUpdatedAt: serverTimestamp()
            }));
        }
    }
    await Promise.all(operations);
}

export async function syncDataDiff(before, after) {
    if (!db || !auth?.currentUser) throw new Error("NOT_AUTHENTICATED");
    dispatchSyncStatus("saving");
    try {
        for (const name of COLLECTIONS) {
            if (!deepEqual(before?.[name], after?.[name])) {
                await syncCollectionDiff(name, before?.[name], after?.[name]);
            }
        }
        dispatchSyncStatus("connected");
    } catch (error) {
        console.error("Änderungen konnten nicht mit Firebase synchronisiert werden.", error);
        dispatchSyncStatus("error", "Änderung noch nicht synchronisiert");
        throw error;
    }
}

export async function replaceAllCloudData(data) {
    if (!db || !auth?.currentUser) throw new Error("NOT_AUTHENTICATED");
    dispatchSyncStatus("saving");
    try {
        for (const name of COLLECTIONS) {
            const existing = await getDocs(cloudCollection(name));
            const operations = existing.docs.map((item) => ({ type: "delete", reference: item.ref }));
            for (const item of data[name] || []) {
                operations.push({ type: "set", reference: recordReference(name, item.id), data: item });
            }
            for (let index = 0; index < operations.length; index += 400) {
                const batch = writeBatch(db);
                operations.slice(index, index + 400).forEach((operation) => {
                    if (operation.type === "delete") batch.delete(operation.reference);
                    else batch.set(operation.reference, {
                        ...cloneForCloud(operation.data),
                        cloudUpdatedAt: serverTimestamp()
                    });
                });
                await batch.commit();
            }
        }
        dispatchSyncStatus("connected");
    } catch (error) {
        dispatchSyncStatus("error", "Cloud-Daten konnten nicht ersetzt werden");
        throw error;
    }
}

export { COLLECTIONS };
