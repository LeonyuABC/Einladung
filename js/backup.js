import { loadData, normalizeData, replaceSharedData, resetAllData } from "./storage.js";

function downloadJson(data) {
    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    const today = new Date();
    const fileDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    link.href = URL.createObjectURL(blob);
    link.download = `couple-space-backup-${fileDate}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}

function hasValidBackupShape(value) {
    return value
        && typeof value === "object"
        && !Array.isArray(value)
        && value.version === 1
        && Array.isArray(value.invitations)
        && Array.isArray(value.plans)
        && Array.isArray(value.diaryEntries)
        && Array.isArray(value.wishlistItems)
        && (value.moods === undefined || Array.isArray(value.moods));
}

export function renderBackup(container, context) {
    container.innerHTML = `
        <header class="page-header">
            <p class="eyebrow">EINSTELLUNGEN</p>
            <h1>Daten &amp; Backup</h1>
            <p class="muted">Die Daten werden über Firebase synchronisiert. Ein zusätzliches JSON-Backup schützt eure gemeinsamen Einträge.</p>
        </header>
        <section class="two-column">
            <article class="module-card">
                <h2>Backup</h2>
                <p class="muted">Exportiere den aktuellen gemeinsamen Datenstand als JSON-Datei.</p>
                <div class="action-row">
                    <button id="export-data" class="primary-button" type="button">Daten exportieren</button>
                    <label class="secondary-button" for="import-data">Daten importieren</label>
                    <input id="import-data" class="sr-only" type="file" accept="application/json,.json">
                </div>
                <p id="backup-status" class="status-message" aria-live="polite"></p>
                <p id="backup-error" class="error-message" aria-live="polite"></p>
            </article>
            <article class="module-card">
                <h2>Gemeinsame Cloud-Daten</h2>
                <p class="muted">Änderungen werden auf beiden Geräten synchronisiert. Das gilt auch für das Löschen.</p>
                <div class="warning-notice">Achtung: Diese Aktion löscht Einladungen, Pläne, Tagebuch, Wünsche und tägliche Stimmungen für Yaoyu und Daria auf allen Geräten.</div>
                <div class="action-row" style="margin-top:16px">
                    <button id="delete-all-data" class="danger-button" type="button">Alle gemeinsamen Daten löschen</button>
                </div>
            </article>
        </section>
        <div class="action-row" style="margin-top:20px">
            <button class="secondary-button" type="button" data-route="home">← Zur Startseite</button>
        </div>`;

    const status = container.querySelector("#backup-status");
    const error = container.querySelector("#backup-error");

    container.querySelector("#export-data").addEventListener("click", () => {
        downloadJson(loadData());
        status.textContent = "Backup wurde heruntergeladen.";
        error.textContent = "";
    });

    container.querySelector("#import-data").addEventListener("change", async (event) => {
        status.textContent = "";
        error.textContent = "";
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 5_000_000) {
            error.textContent = "Die Datei ist zu groß.";
            event.target.value = "";
            return;
        }
        try {
            const parsed = JSON.parse(await file.text());
            if (!hasValidBackupShape(parsed)) throw new Error("INVALID_BACKUP");
            if (!window.confirm("Dieses Backup ersetzt den gemeinsamen Firebase-Datenstand für Yaoyu und Daria. Fortfahren?")) {
                event.target.value = "";
                return;
            }
            status.textContent = "Backup wird in Firebase importiert ...";
            await replaceSharedData(normalizeData(parsed));
            context.toast("Gemeinsame Daten wurden erfolgreich importiert.");
            context.refresh();
        } catch (importError) {
            console.error("Backup-Import fehlgeschlagen.", importError);
            error.textContent = "Das Backup ist ungültig oder konnte nicht in Firebase gespeichert werden. Bitte prüfe Datei und Verbindung.";
        } finally {
            event.target.value = "";
        }
    });

    container.querySelector("#delete-all-data").addEventListener("click", async (event) => {
        const first = window.confirm("Möchtest du wirklich alle gemeinsamen Couple-Space-Daten für beide Personen löschen?");
        if (!first) return;
        const second = window.confirm("Letzte Bestätigung: Die Daten verschwinden auf allen Geräten und können ohne Backup nicht wiederhergestellt werden. Jetzt löschen?");
        if (!second) return;
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = "Wird gelöscht ...";
        try {
            await resetAllData();
            context.toast("Alle gemeinsamen Daten wurden gelöscht.");
            context.onReset();
        } catch (deleteError) {
            console.error("Cloud-Daten konnten nicht gelöscht werden.", deleteError);
            error.textContent = "Die Daten konnten nicht gelöscht werden. Prüfe deine Verbindung und Firebase-Berechtigungen.";
            button.disabled = false;
            button.textContent = "Alle gemeinsamen Daten löschen";
        }
    });
}
