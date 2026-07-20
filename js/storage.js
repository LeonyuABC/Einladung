// Eigener Cache-Schlüssel, damit eine ältere reine localStorage-Version nicht
// überschrieben wird. Alte Daten können per JSON-Backup importiert werden.
const STORAGE_KEY = "coupleSpaceCloudCacheV1";
const IDENTITIES = ["Yaoyu", "Daria"];
const SHARED_COLLECTIONS = ["invitations", "plans", "diaryEntries", "wishlistItems"];

let syncDiffHandler = null;
let replaceAllHandler = null;

function emptyData(identity = null) {
    return {
        version: 1,
        currentIdentity: IDENTITIES.includes(identity) ? identity : null,
        invitations: [],
        plans: [],
        diaryEntries: [],
        wishlistItems: []
    };
}

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanArray(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => isRecord(item) && typeof item.id === "string" && item.id.length <= 1000);
}

export function normalizeData(value) {
    const clean = emptyData();
    if (!isRecord(value) || value.version !== 1) return clean;
    clean.currentIdentity = IDENTITIES.includes(value.currentIdentity) ? value.currentIdentity : null;
    SHARED_COLLECTIONS.forEach((name) => { clean[name] = cleanArray(value[name]); });
    return clean;
}

export function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return emptyData();
        return normalizeData(JSON.parse(raw));
    } catch (error) {
        console.warn("Lokaler Zwischenspeicher konnte nicht gelesen werden.", error);
        return emptyData();
    }
}

function saveLocalData(data) {
    const clean = normalizeData({ ...data, version: 1 });
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        return true;
    } catch (error) {
        console.error("Lokaler Zwischenspeicher konnte nicht geschrieben werden.", error);
        return false;
    }
}

// Speichert nur den lokalen Spiegel. Für einen vollständigen Cloud-Ersatz
// (zum Beispiel Backup-Import) replaceSharedData() verwenden.
export function saveData(data) {
    return saveLocalData(data);
}

export function configureCloudStorage({ syncDiff, replaceAll }) {
    syncDiffHandler = typeof syncDiff === "function" ? syncDiff : null;
    replaceAllHandler = typeof replaceAll === "function" ? replaceAll : null;
}

export function applyCloudCollection(name, items) {
    if (!SHARED_COLLECTIONS.includes(name)) return;
    const data = loadData();
    data[name] = cleanArray(items).map((item) => {
        const { cloudUpdatedAt, ...record } = item;
        return record;
    });
    saveLocalData(data);
    window.dispatchEvent(new CustomEvent("couple-space-cloud-data", { detail: { collection: name } }));
}

export function updateData(change) {
    const before = loadData();
    const draft = JSON.parse(JSON.stringify(before));
    const changed = change(draft) || draft;
    const after = normalizeData({ ...changed, version: 1 });
    if (!saveLocalData(after)) throw new Error("STORAGE_WRITE_FAILED");
    if (syncDiffHandler) {
        Promise.resolve(syncDiffHandler(before, after)).catch(() => {
            // Der Synchronisationsstatus wird von cloud.js sichtbar gemeldet.
        });
    }
    return after;
}

export async function replaceSharedData(value) {
    const current = loadData();
    const clean = normalizeData({ ...value, version: 1, currentIdentity: current.currentIdentity });
    if (!replaceAllHandler) throw new Error("CLOUD_NOT_READY");
    await replaceAllHandler(clean);
    saveLocalData(clean);
    return clean;
}

export function getCurrentIdentity() {
    return loadData().currentIdentity;
}

export function setCurrentIdentity(identity) {
    if (!IDENTITIES.includes(identity)) return false;
    const data = loadData();
    data.currentIdentity = identity;
    return saveLocalData(data);
}

export function clearCurrentIdentity() {
    const data = loadData();
    data.currentIdentity = null;
    return saveLocalData(data);
}

export function getOppositeIdentity(identity = getCurrentIdentity()) {
    return identity === "Yaoyu" ? "Daria" : "Yaoyu";
}

export function generateId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function resetAllData() {
    const identity = getCurrentIdentity();
    const clean = emptyData(identity);
    if (!replaceAllHandler) throw new Error("CLOUD_NOT_READY");
    await replaceAllHandler(clean);
    saveLocalData(clean);
}

export function clearLocalCache() {
    localStorage.removeItem(STORAGE_KEY);
}

export function isIdentity(value) {
    return IDENTITIES.includes(value);
}

export function safeText(value, maxLength = 300, fallback = "") {
    if (typeof value !== "string") return fallback;
    return value.trim().slice(0, maxLength);
}

export function isIsoDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function localToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function formatDate(value, options = {}) {
    if (!isIsoDate(value)) return "Keine Auswahl";
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("de-DE", {
        day: "numeric",
        month: "long",
        year: "numeric",
        ...options
    });
}

export function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

export { STORAGE_KEY, IDENTITIES, SHARED_COLLECTIONS };
