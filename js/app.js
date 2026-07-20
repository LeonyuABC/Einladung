import {
    applyCloudCollection,
    configureCloudStorage,
    loadData,
    formatDate,
    getCurrentIdentity,
    localToday
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
import { renderInvitations, renderInvitationShare } from "./invitation.js";
import { renderCalendar, renderPlanShare } from "./calendar.js";
import { renderDiary, renderDiaryShare } from "./diary.js";
import { renderWishlist, renderWishlistShare } from "./wishlist.js";
import { renderBackup } from "./backup.js";
import { renderHomeMoods, renderMood } from "./mood.js";

const main = document.querySelector("#main-content");
const toastElement = document.querySelector("#toast");
const shareDialog = document.querySelector("#share-dialog");
const shareOutput = document.querySelector("#share-url-output");
const shareDialogMessage = document.querySelector("#share-dialog-message");
const syncStatus = document.querySelector("#sync-status");
const validRoutes = new Set(["home", "mood", "invitations", "calendar", "diary", "wishlist", "settings"]);

let toastTimer = null;
let shareRequest = null;
let shareError = null;
const prefills = new Map();

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

function currentRoute() {
    const route = window.location.hash.replace(/^#/, "");
    return validRoutes.has(route) ? route : "home";
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

function navigate(route, prefill = null) {
    if (!validRoutes.has(route)) route = "home";
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

function renderHome() {
    const data = loadData();
    const identity = getCurrentIdentity();
    const nextPlan = data.plans
        .filter((plan) => typeof plan.date === "string" && plan.date >= localToday())
        .sort((a, b) => a.date.localeCompare(b.date))[0];
    const latestDiary = data.diaryEntries
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const matches = data.wishlistItems.filter((wish) => wish.reactions?.Yaoyu === "HEART" && wish.reactions?.Daria === "HEART").length;

    main.innerHTML = `
        <section class="home-hero">
            <article class="card hero-copy">
                <p class="eyebrow">UNSER KLEINER SPACE</p>
                <h1 id="home-greeting"></h1>
                <p class="muted">Ein ruhiger Ort für eure Einladungen, Pläne, Erinnerungen und Wünsche.</p>
            </article>
            <aside class="card hero-note">
                <div><div class="big-emoji">♡</div><h2>Yaoyu &amp; Daria</h2><p class="muted">Zwei Geräte, ein gemeinsamer Raum.</p></div>
            </aside>
        </section>
        <section class="home-mood-section">
            <div class="section-heading">
                <div><p class="eyebrow">HEUTE</p><h2>Wie geht es euch?</h2></div>
                <button class="primary-button" type="button" data-route="mood">Stimmung auswählen</button>
            </div>
            <div id="home-mood-grid" class="mood-person-grid"></div>
        </section>
        <section class="module-grid" aria-label="Bereiche">
            <button class="module-link" type="button" data-route="invitations"><span class="emoji">💌</span><strong>Einladung</strong></button>
            <button class="module-link" type="button" data-route="calendar"><span class="emoji">📅</span><strong>Planungszentrum</strong></button>
            <button class="module-link" type="button" data-route="diary"><span class="emoji">📖</span><strong>Aktivitätstagebuch</strong></button>
            <button class="module-link" type="button" data-route="wishlist"><span class="emoji">✨</span><strong>Wunschliste</strong></button>
        </section>
        <section>
            <div class="section-heading"><h2>Auf einen Blick</h2><button class="text-button" type="button" data-route="settings">⚙️ Einstellungen &amp; Backup</button></div>
            <div class="summary-grid">
                <article class="summary-card"><p class="eyebrow">NÄCHSTER PLAN</p><h3 id="home-next-plan"></h3><p id="home-next-plan-meta" class="meta"></p></article>
                <article class="summary-card"><p class="eyebrow">LETZTE ERINNERUNG</p><h3 id="home-diary"></h3><p id="home-diary-meta" class="meta"></p></article>
                <article class="summary-card"><p class="eyebrow">PERFECT MATCHES</p><h3 id="home-matches"></h3><p class="meta">Wünsche, die ihr beide mögt.</p></article>
            </div>
        </section>`;
    main.querySelector("#home-greeting").textContent = `Hi ${identity}`;
    main.querySelector("#home-next-plan").textContent = nextPlan ? `${nextPlan.emoji || "📅"} ${nextPlan.activity || "Gemeinsamer Plan"}` : "Noch nichts geplant";
    main.querySelector("#home-next-plan-meta").textContent = nextPlan ? formatDate(nextPlan.date, { weekday: "long" }) : "Vielleicht ist jetzt der richtige Moment.";
    main.querySelector("#home-diary").textContent = latestDiary ? `${latestDiary.emoji || "📖"} ${latestDiary.title || "Erinnerung"}` : "Noch keine Erinnerung";
    main.querySelector("#home-diary-meta").textContent = latestDiary ? formatDate(latestDiary.date) : "Euer erstes Kapitel wartet.";
    main.querySelector("#home-matches").textContent = String(matches);
    renderHomeMoods(main.querySelector("#home-mood-grid"));
}

function renderShare() {
    setActiveNavigation("");
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
        renderWishlistShare(main, shareRequest.data, context);
    } else {
        renderShareError();
    }
    main.focus();
}

function renderRoute(route = currentRoute()) {
    if (!hasIdentity()) {
        showIdentitySelection();
        return;
    }
    showApp();
    updateIdentityLabel();
    if (shareRequest || shareError) {
        renderShare();
        return;
    }
    setActiveNavigation(route);
    if (route === "home") renderHome();
    if (route === "mood") renderMood(main, context);
    if (route === "invitations") renderInvitations(main, context);
    if (route === "calendar") renderCalendar(main, context);
    if (route === "diary") renderDiary(main, context);
    if (route === "wishlist") renderWishlist(main, context);
    if (route === "settings") renderBackup(main, context);
    document.title = route === "home" ? "Couple Space" : `${route[0].toUpperCase()}${route.slice(1)} · Couple Space`;
    main.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (!routeButton) return;
    event.preventDefault();
    navigate(routeButton.dataset.route);
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
window.addEventListener("couple-space-cloud-data", () => {
    window.clearTimeout(cloudRefreshTimer);
    cloudRefreshTimer = window.setTimeout(() => {
        if (!hasIdentity()) return;
        if (main.querySelector("form:focus-within")) {
            toast("Neue gemeinsame Daten sind angekommen. Nach dem Speichern wird die Ansicht aktualisiert.");
            return;
        }
        renderRoute(currentRoute());
    }, 120);
});

configureCloudStorage({
    syncDiff: syncDataDiff,
    replaceAll: replaceAllCloudData
});

initializeIdentity(() => {
    startRealtimeSync((name, items) => applyCloudCollection(name, items));
    renderRoute(currentRoute());
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
            .catch((error) => console.warn("App-Installation konnte nicht vorbereitet werden.", error));
    });
}
