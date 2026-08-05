import {
    applyCloudCollection,
    cleanupNotifications,
    configureCloudStorage,
    getCurrentIdentity,
    loadData,
    updateData
} from "./storage.js";
import {
    replaceAllCloudData,
    startRealtimeSync,
    syncDataDiff
} from "./cloud.js";
import {
    buildShareUrl,
    clearShareParametersFromAddressBar,
    copyShareUrl,
    readShareParameters,
    shareUrl
} from "./share.js";
import { hasIdentity, initializeIdentity, showApp, showIdentitySelection, updateIdentityLabel } from "./identity.js";
import { renderInvitationShare } from "./invitation.js";
import { renderPlanShare, renderStart, stopStartTimers } from "./calendar.js";
import { renderDiary, renderDiaryShare } from "./diary.js";
import { renderIdeaShare, renderIdeas } from "./ideas.js";
import { renderBackup } from "./backup.js";

const main = document.querySelector("#main-content");
const toastElement = document.querySelector("#toast");
const shareDialog = document.querySelector("#share-dialog");
const shareOutput = document.querySelector("#share-url-output");
const shareDialogMessage = document.querySelector("#share-dialog-message");
const syncStatus = document.querySelector("#sync-status");
const notificationArea = document.querySelector("#notification-area");
const notificationButton = document.querySelector("#notification-button");
const notificationDot = document.querySelector("#notification-dot");
const notificationPanel = document.querySelector("#notification-panel");
const notificationList = document.querySelector("#notification-list");
const notificationEmpty = document.querySelector("#notification-empty");
const markNotificationsReadButton = document.querySelector("#mark-notifications-read");
const validRoutes = new Set(["home", "diary", "ideas", "settings"]);
const legacyRoutes = new Map([
    ["mood", "home"],
    ["calendar", "home"],
    ["invitations", "ideas"],
    ["wishlist", "ideas"]
]);

let toastTimer = null;
let shareRequest = null;
let shareError = null;
const prefills = new Map();
let cleanupQueued = false;

function ownNotifications() {
    const identity = getCurrentIdentity();
    return (loadData().notifications || [])
        .filter((item) => item?.recipient === identity && typeof item.message === "string")
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
        .slice(0, 20);
}

function notificationTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function setNotificationRead(id) {
    updateData((data) => {
        const notification = data.notifications.find((item) => item.id === id);
        if (notification && notification.recipient === getCurrentIdentity()) {
            notification.read = true;
            notification.readAt = new Date().toISOString();
        }
        return data;
    });
}

function renderNotificationCenter() {
    const notifications = ownNotifications();
    const unread = notifications.filter((item) => !item.read);
    notificationDot.hidden = unread.length === 0;
    notificationButton.setAttribute("aria-label", unread.length
        ? `Benachrichtigungen, ${unread.length} ungelesen`
        : "Benachrichtigungen");
    markNotificationsReadButton.hidden = unread.length === 0;
    notificationEmpty.hidden = notifications.length !== 0;
    notificationList.replaceChildren();

    notifications.forEach((notification) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `notification-item${notification.read ? "" : " unread"}`;
        const message = document.createElement("span");
        message.className = "notification-message";
        message.textContent = notification.message;
        const time = document.createElement("span");
        time.className = "notification-time";
        time.textContent = notificationTime(notification.createdAt);
        button.append(message, time);
        button.addEventListener("click", () => {
            if (!notification.read) setNotificationRead(notification.id);
            closeNotificationPanel();
            navigate(notification.route || "home");
        });
        notificationList.append(button);
    });
}

function closeNotificationPanel() {
    notificationPanel.hidden = true;
    notificationButton.setAttribute("aria-expanded", "false");
}

try {
    shareRequest = readShareParameters();
} catch (error) {
    shareError = error;
}

function toast(message) {
    window.clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.classList.add("visible");
    toastTimer = window.setTimeout(() => toastElement.classList.remove("visible"), 2800);
}

function normalizeRoute(route) {
    if (legacyRoutes.has(route)) return legacyRoutes.get(route);
    return validRoutes.has(route) ? route : "home";
}

function currentRoute() {
    return normalizeRoute(window.location.hash.replace(/^#/, ""));
}

function setActiveNavigation(route) {
    document.querySelectorAll(".main-nav [data-route]").forEach((button) => {
        const active = button.dataset.route === route;
        button.classList.toggle("active", active);
        if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
}

function consumePrefill(route) {
    const value = prefills.get(route) || null;
    prefills.delete(route);
    return value;
}

function navigate(rawRoute, prefill = null) {
    const route = normalizeRoute(rawRoute);
    if (prefill && typeof prefill === "object") prefills.set(route, prefill);
    if (shareRequest || shareError) {
        clearShareParametersFromAddressBar();
        shareRequest = null;
        shareError = null;
    }
    if (window.location.hash === `#${route}`) renderRoute(route);
    else window.location.hash = route;
}

async function showShare(type, object, title, text) {
    let url;
    try {
        url = buildShareUrl(type, object);
    } catch (error) {
        toast("Der Link konnte nicht erstellt werden.");
        return;
    }
    const result = await shareUrl(url, title, text);
    if (result.method === "copied") {
        toast("Link wurde kopiert.");
        return;
    }
    if (result.method === "shared" || result.method === "cancelled") return;
    shareOutput.value = url;
    shareDialogMessage.textContent = "Automatisches Kopieren war nicht möglich. Markiere den Link und kopiere ihn manuell.";
    if (typeof shareDialog.showModal === "function") shareDialog.showModal();
    else shareOutput.focus();
}

function clearShare(goHome = true) {
    clearShareParametersFromAddressBar();
    shareRequest = null;
    shareError = null;
    if (goHome) navigate("home");
}

function renderShareError() {
    main.innerHTML = `
        <header class="page-header"><p class="eyebrow">SHARE-LINK</p><h1>Dieser Link ist nicht gültig</h1></header>
        <section class="module-card">
            <p class="muted">Die geteilten Daten konnten nicht sicher gelesen werden. Bitte lass einen neuen Link erstellen.</p>
            <button id="dismiss-invalid-share" class="primary-button" type="button">Zur Startseite</button>
        </section>`;
    main.querySelector("#dismiss-invalid-share").addEventListener("click", () => clearShare(true));
}

const context = {
    toast,
    navigate,
    showShare,
    consumePrefill,
    clearShare,
    renderShareError,
    refresh: () => renderRoute(currentRoute()),
    onReset: () => {
        shareRequest = null;
        shareError = null;
        navigate("home");
    }
};

function renderShare() {
    setActiveNavigation("");
    stopStartTimers();
    if (shareError) {
        renderShareError();
        return;
    }
    if (!shareRequest) return;
    if (shareRequest.type === "invite" || shareRequest.type === "inviteResponse") {
        renderInvitationShare(main, shareRequest.data, shareRequest.type, context);
    } else if (shareRequest.type === "plan") {
        renderPlanShare(main, shareRequest.data, context);
    } else if (shareRequest.type === "diary") {
        renderDiaryShare(main, shareRequest.data, context);
    } else if (shareRequest.type === "wishlist") {
        renderIdeaShare(main, shareRequest.data, context);
    } else {
        renderShareError();
    }
    main.focus();
}

function renderRoute(route = currentRoute()) {
    route = normalizeRoute(route);
    if (!hasIdentity()) {
        showIdentitySelection();
        return;
    }
    showApp();
    updateIdentityLabel();
    renderNotificationCenter();
    if (shareRequest || shareError) {
        renderShare();
        return;
    }
    setActiveNavigation(route);
    if (route !== "home") stopStartTimers();
    if (route === "home") renderStart(main, context);
    if (route === "diary") renderDiary(main, context);
    if (route === "ideas") renderIdeas(main, context);
    if (route === "settings") renderBackup(main, context);
    const titles = { home: "Couple Space", diary: "Tagebuch · Couple Space", ideas: "Unsere Ideen · Couple Space", settings: "Einstellungen · Couple Space" };
    document.title = titles[route] || "Couple Space";
    main.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelector("#switch-identity").addEventListener("click", () => stopStartTimers());

document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (!routeButton) return;
    event.preventDefault();
    navigate(routeButton.dataset.route);
});

notificationButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = notificationPanel.hidden;
    if (willOpen) renderNotificationCenter();
    notificationPanel.hidden = !willOpen;
    notificationButton.setAttribute("aria-expanded", String(willOpen));
});

notificationPanel.addEventListener("click", (event) => event.stopPropagation());

markNotificationsReadButton.addEventListener("click", () => {
    const identity = getCurrentIdentity();
    updateData((data) => {
        data.notifications.forEach((notification) => {
            if (notification.recipient === identity && !notification.read) {
                notification.read = true;
                notification.readAt = new Date().toISOString();
            }
        });
        return data;
    });
    renderNotificationCenter();
});

document.addEventListener("click", (event) => {
    if (!notificationPanel.hidden && !notificationArea.contains(event.target)) closeNotificationPanel();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !notificationPanel.hidden) {
        closeNotificationPanel();
        notificationButton.focus();
    }
});

document.querySelector("#copy-dialog-link").addEventListener("click", async () => {
    const copied = await copyShareUrl(shareOutput.value);
    if (copied) {
        toast("Link wurde kopiert.");
        shareDialog.close();
    } else {
        shareOutput.focus();
        shareOutput.select();
        shareDialogMessage.textContent = "Bitte kopiere den markierten Link manuell.";
    }
});

window.addEventListener("hashchange", () => renderRoute(currentRoute()));

window.addEventListener("couple-space-sync-status", (event) => {
    const { status, message } = event.detail || {};
    syncStatus.dataset.status = status || "connecting";
    const labels = {
        connecting: "● Verbinden ...",
        connected: "● Synchronisiert",
        saving: "● Speichern ...",
        error: `● ${message || "Offline"}`
    };
    syncStatus.textContent = labels[status] || labels.connecting;
});

let cloudRefreshTimer = null;
window.addEventListener("couple-space-cloud-data", (event) => {
    if (event.detail?.collection === "notifications" && !cleanupQueued) {
        cleanupQueued = true;
        window.setTimeout(() => {
            cleanupQueued = false;
            try { cleanupNotifications(); } catch (error) { console.warn("Benachrichtigungen konnten nicht bereinigt werden.", error); }
        }, 50);
    }
    window.clearTimeout(cloudRefreshTimer);
    cloudRefreshTimer = window.setTimeout(() => {
        if (!hasIdentity()) return;
        renderNotificationCenter();
        if (main.querySelector("form:focus-within")) {
            toast("Neue gemeinsame Daten sind angekommen. Nach dem Speichern wird die Ansicht aktualisiert.");
            return;
        }
        renderRoute(currentRoute());
    }, 140);
});

configureCloudStorage({
    syncDiff: syncDataDiff,
    replaceAll: replaceAllCloudData
});

initializeIdentity(() => {
    try {
        startRealtimeSync((name, items) => applyCloudCollection(name, items));
    } catch (error) {
        console.error("Firebase-Synchronisierung konnte nicht gestartet werden.", error);
        toast("Synchronisierung konnte nicht gestartet werden.");
    }
    renderRoute(currentRoute());
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
            .catch((error) => console.warn("App-Installation konnte nicht vorbereitet werden.", error));
    });
}
