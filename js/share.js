const SHARE_TYPES = new Set(["invite", "inviteResponse", "plan", "diary", "wishlist"]);
const MAX_ENCODED_LENGTH = 30000;

function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

export function encodeShareData(object) {
    const json = JSON.stringify(object);
    const base64 = bytesToBase64(new TextEncoder().encode(json));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeShareData(text) {
    if (typeof text !== "string" || !text || text.length > MAX_ENCODED_LENGTH || !/^[A-Za-z0-9_-]+$/.test(text)) {
        throw new Error("INVALID_SHARE_DATA");
    }
    const padding = "=".repeat((4 - (text.length % 4)) % 4);
    const base64 = text.replace(/-/g, "+").replace(/_/g, "/") + padding;
    try {
        const json = new TextDecoder("utf-8", { fatal: true }).decode(base64ToBytes(base64));
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        return parsed;
    } catch (error) {
        throw new Error("INVALID_SHARE_DATA");
    }
}

export function buildShareUrl(type, object) {
    if (!SHARE_TYPES.has(type)) throw new Error("INVALID_SHARE_TYPE");
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("share", type);
    url.searchParams.set("data", encodeShareData(object));
    return url.toString();
}

export async function copyShareUrl(url) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(url);
            return true;
        }
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        return copied;
    } catch (error) {
        return false;
    }
}

export async function shareUrl(url, title = "Couple Space", text = "") {
    if (navigator.share) {
        try {
            await navigator.share({ title, text, url });
            return { method: "shared", copied: false };
        } catch (error) {
            if (error?.name === "AbortError") return { method: "cancelled", copied: false };
        }
    }
    const copied = await copyShareUrl(url);
    return { method: copied ? "copied" : "manual", copied };
}

export function readShareParameters() {
    const parameters = new URLSearchParams(window.location.search);
    const type = parameters.get("share");
    const encoded = parameters.get("data");
    if (!type && !encoded) return null;
    if (!SHARE_TYPES.has(type) || !encoded) throw new Error("INVALID_SHARE_LINK");
    return { type, data: decodeShareData(encoded) };
}

export function clearShareParametersFromAddressBar() {
    const url = new URL(window.location.href);
    url.searchParams.delete("share");
    url.searchParams.delete("data");
    history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
