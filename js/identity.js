import { getCurrentIdentity, setCurrentIdentity } from "./storage.js";

const identityView = document.querySelector("#identity-view");
const appView = document.querySelector("#app-view");
const identityLabel = document.querySelector("#identity-label");

let afterSelection = null;

export function updateIdentityLabel() {
    const identity = getCurrentIdentity();
    identityLabel.textContent = identity ? `Aktuell: ${identity}` : "Aktuell: –";
}

export function showIdentitySelection(callback) {
    afterSelection = callback;
    appView.hidden = true;
    identityView.hidden = false;
    document.querySelector("[data-identity]")?.focus();
}

export function showApp() {
    identityView.hidden = true;
    appView.hidden = false;
    updateIdentityLabel();
}

export function initializeIdentity(onSelected) {
    document.querySelectorAll("[data-identity]").forEach((button) => {
        button.addEventListener("click", () => {
            const identity = button.dataset.identity;
            if (!setCurrentIdentity(identity)) return;
            showApp();
            const callback = afterSelection || onSelected;
            afterSelection = null;
            callback?.(identity);
        });
    });

    document.querySelector("#switch-identity").addEventListener("click", () => {
        showIdentitySelection(onSelected);
    });
}

export function hasIdentity() {
    return Boolean(getCurrentIdentity());
}
