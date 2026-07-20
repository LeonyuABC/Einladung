const STORAGE_KEY = "coupleSpaceDataV1";
const IDENTITIES = ["Yaoyu", "Daria"];

function emptyData() {
    return {
        version: 1,
        currentIdentity: null,
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
    clean.invitations = cleanArray(value.invitations);
    clean.plans = cleanArray(value.plans);
    clean.diaryEntries = cleanArray(value.diaryEntries);
    clean.wishlistItems = cleanArray(value.wishlistItems);
    return clean;
}

export function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return emptyData();
        return normalizeData(JSON.parse(raw));
    } catch (error) {
        console.warn("Lokale Daten konnten nicht gelesen werden.", error);
        return emptyData();
    }
}

export function saveData(data) {
    const clean = normalizeData({ ...data, version: 1 });
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        return true;
    } catch (error) {
        console.error("Lokale Daten konnten nicht gespeichert werden.", error);
        return false;
    }
}

export function updateData(change) {
    const data = loadData();
    const result = change(data) || data;
    if (!saveData(result)) throw new Error("STORAGE_WRITE_FAILED");
    return normalizeData(result);
}

export function getCurrentIdentity() {
    return loadData().currentIdentity;
}

export function setCurrentIdentity(identity) {
    if (!IDENTITIES.includes(identity)) return false;
    const data = loadData();
    data.currentIdentity = identity;
    return saveData(data);
}

export function getOppositeIdentity(identity = getCurrentIdentity()) {
    return identity === "Yaoyu" ? "Daria" : "Yaoyu";
}

export function generateId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function resetAllData() {
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

export { STORAGE_KEY, IDENTITIES };
