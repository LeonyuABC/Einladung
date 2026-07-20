import { loadData, normalizeData, resetAllData, saveData } from "./storage.js";

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
        && Array.isArray(value.wishlistItems);
}

export function renderBackup(container, context) {
    container.innerHTML = `
        <header class="page-header">
            <p class="eyebrow">EINSTELLUNGEN</p>
            <h1>Daten &amp; Backup</h1>
            <p class="muted">Alles bleibt in diesem Browser. Ein Backup schützt deine gemeinsamen Einträge.</p>
        </header>
        <section class="two-column">
            <article class="module-card">
                <h2>Backup</h2>
                <p class="muted">Exportiere alle lokalen Einladungen, Pläne, Tagebucheinträge und Wünsche als JSON-Datei.</p>
                <div class="action-row">
                    <button id="export-data" class="primary-button" type="button">Daten exportieren</button>
                    <label class="secondary-button" for="import-data">Daten importieren</label>
                    <input id="import-data" class="sr-only" type="file" accept="application/json,.json">
                </div>
                <p id="backup-status" class="status-message" aria-live="polite"></p>
                <p id="backup-error" class="error-message" aria-live="polite"></p>
            </article>
            <article class="module-card">
                <h2>Lokale Speicherung</h2>
                <p class="muted">Daten werden nicht automatisch zwischen Geräten synchronisiert. Nutzt stattdessen Share-Links und Backups.</p>
                <div class="warning-notice">Das Löschen betrifft nur diesen Browser, kann ohne Backup aber nicht rückgängig gemacht werden.</div>
                <div class="action-row" style="margin-top:16px">
                    <button id="delete-all-data" class="danger-button" type="button">Alle lokalen Daten löschen</button>
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
            if (!window.confirm("Dieses Backup ersetzt alle lokalen Couple-Space-Daten in diesem Browser. Fortfahren?")) {
                event.target.value = "";
                return;
            }
            if (!saveData(normalizeData(parsed))) throw new Error("WRITE_FAILED");
            context.toast("Daten wurden erfolgreich importiert.");
            context.refresh();
        } catch (importError) {
            error.textContent = "Diese Datei ist kein gültiges Couple-Space-Backup. Deine bisherigen Daten wurden nicht verändert.";
        } finally {
            event.target.value = "";
        }
    });

    container.querySelector("#delete-all-data").addEventListener("click", () => {
        const first = window.confirm("Möchtest du wirklich alle lokalen Couple-Space-Daten in diesem Browser löschen?");
        if (!first) return;
        const second = window.confirm("Letzte Bestätigung: Ohne Backup können diese Daten nicht wiederhergestellt werden. Jetzt löschen?");
        if (!second) return;
        resetAllData();
        context.onReset();
    });
}
