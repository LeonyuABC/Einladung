import { CONFIG } from "../config.js";
import {
    ensureAnonymousUser,
    initializeCloud,
    isCloudConfigured
} from "./cloud.js";
import {
    clearCurrentIdentity,
    getCurrentIdentity,
    setCurrentIdentity
} from "./storage.js";

const identityView = document.querySelector("#identity-view");
const appView = document.querySelector("#app-view");
const identityLabel = document.querySelector("#identity-label");
const identityOptions = document.querySelector("#identity-options");
const identityButtons = [...document.querySelectorAll("[data-identity]")];
const pinForm = document.querySelector("#pin-login-form");
const pinPerson = document.querySelector("#pin-person");
const pinInput = document.querySelector("#login-pin");
const loginButton = document.querySelector("#pin-login-button");
const loginStatus = document.querySelector("#login-status");
const loginError = document.querySelector("#login-error");
const configWarning = document.querySelector("#firebase-config-warning");

let authenticatedCallback = null;
let selectedIdentity = null;
let cloudReady = false;

function applyIdentityTheme(identity = null) {
    const theme = identity === "Yaoyu" ? "blue" : "pink";
    document.documentElement.dataset.theme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === "blue" ? "#6aa9d8" : "#d9688b";
}

export function updateIdentityLabel() {
    const identity = getCurrentIdentity();
    identityLabel.textContent = identity ? `Aktiv: ${identity}` : "Aktiv: –";
}

function resetSelection() {
    selectedIdentity = null;
    pinForm.hidden = true;
    identityOptions.hidden = false;
    pinInput.value = "";
    loginError.textContent = "";
    identityButtons.forEach((button) => { button.disabled = !cloudReady; });
}

export function showIdentitySelection() {
    applyIdentityTheme();
    appView.hidden = true;
    identityView.hidden = false;
    resetSelection();
    identityButtons[0]?.focus();
}

export function showApp() {
    applyIdentityTheme(getCurrentIdentity());
    identityView.hidden = true;
    appView.hidden = false;
    updateIdentityLabel();
}

function chooseIdentity(identity) {
    if (!cloudReady || !CONFIG.users?.[identity]) return;
    selectedIdentity = identity;
    identityOptions.hidden = true;
    pinForm.hidden = false;
    pinPerson.textContent = `Hallo ${identity} ♡`;
    loginError.textContent = "";
    pinInput.value = "";
    pinInput.focus();
}

function friendlyConnectionError(error) {
    if (error?.code === "auth/operation-not-allowed") {
        return "Anonyme Anmeldung ist in Firebase noch nicht aktiviert. Folge FIREBASE-SETUP.md.";
    }
    if (error?.code === "auth/network-request-failed") {
        return "Keine Verbindung zu Firebase. Prüfe die Internetverbindung.";
    }
    return "Firebase konnte nicht gestartet werden. Prüfe die Einstellungen und versuche es erneut.";
}

async function submitPin(event) {
    event.preventDefault();
    if (!selectedIdentity || !pinForm.reportValidity()) return;
    loginButton.disabled = true;
    loginError.textContent = "";
    try {
        const expectedPin = String(CONFIG.users[selectedIdentity]?.pin ?? "");
        if (pinInput.value !== expectedPin) {
            loginError.textContent = "Die PIN stimmt nicht. Versuch es noch einmal.";
            pinInput.select();
            return;
        }
        setCurrentIdentity(selectedIdentity);
        showApp();
        authenticatedCallback?.(selectedIdentity);
    } finally {
        loginButton.disabled = false;
    }
}

export async function initializeIdentity(onAuthenticated) {
    authenticatedCallback = onAuthenticated;
    // Bei einem neuen Seitenaufruf wird die Person bewusst neu gewählt. Die
    // gemeinsame Datenkopie bleibt erhalten; nur die lokale Personenauswahl
    // wird zurückgesetzt.
    clearCurrentIdentity();
    identityButtons.forEach((button) => {
        button.disabled = true;
        button.addEventListener("click", () => chooseIdentity(button.dataset.identity));
    });
    pinForm.addEventListener("submit", submitPin);
    document.querySelector("#cancel-pin").addEventListener("click", resetSelection);
    document.querySelector("#switch-identity").addEventListener("click", () => {
        clearCurrentIdentity();
        showIdentitySelection();
    });

    showIdentitySelection();
    if (!isCloudConfigured()) {
        configWarning.hidden = false;
        loginError.textContent = "Firebase-Konfiguration fehlt. Öffne FIREBASE-SETUP.md.";
        return;
    }

    loginStatus.textContent = "Gemeinsamer Raum wird verbunden ...";
    try {
        await initializeCloud();
        await ensureAnonymousUser();
        cloudReady = true;
        loginStatus.textContent = "Bereit – wähle deine Person.";
        identityButtons.forEach((button) => { button.disabled = false; });

    } catch (error) {
        console.error("Firebase konnte nicht initialisiert werden.", error);
        loginStatus.textContent = "";
        loginError.textContent = friendlyConnectionError(error);
    }
}

export function hasIdentity() {
    return Boolean(getCurrentIdentity());
}
