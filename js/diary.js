import {
    clone,
    formatDate,
    generateId,
    getCurrentIdentity,
    isIdentity,
    isIsoDate,
    loadData,
    localToday,
    safeText,
    updateData
} from "./storage.js";
import { isPlainObject } from "./share.js";

const MOODS = [
    "🤩 Wunderschön",
    "❤️ Romantisch",
    "😄 Lustig",
    "😊 Schön",
    "😌 Entspannt",
    "😐 Okay",
    "😕 Nicht ganz mein Ding",
    "😠 Schlecht"
];

function sanitizeContribution(value) {
    if (!isPlainObject(value) || !MOODS.includes(value.mood)) return null;
    return {
        mood: value.mood,
        favoriteMoment: safeText(value.favoriteMoment, 300),
        updatedAt: safeText(value.updatedAt, 50) || new Date().toISOString()
    };
}

export function sanitizeSharedDiary(value) {
    if (!isPlainObject(value) || value.kind !== "DIARY") throw new Error("INVALID_DIARY");
    const id = safeText(value.id, 1000);
    const title = safeText(value.title, 300);
    if (!id || !title || !isIsoDate(value.date) || !isIdentity(value.createdBy)) throw new Error("INVALID_DIARY");
    return {
        kind: "DIARY",
        id,
        createdAt: safeText(value.createdAt, 50) || new Date().toISOString(),
        createdBy: value.createdBy,
        date: value.date,
        emoji: safeText(value.emoji, 12, "📖") || "📖",
        title,
        description: safeText(value.description, 300),
        contributions: {
            Yaoyu: sanitizeContribution(value.contributions?.Yaoyu),
            Daria: sanitizeContribution(value.contributions?.Daria)
        },
        shareMode: value.shareMode === "response" ? "response" : "item"
    };
}

function createEntry(form) {
    const fields = new FormData(form);
    return {
        kind: "DIARY",
        id: generateId(),
        createdAt: new Date().toISOString(),
        createdBy: getCurrentIdentity(),
        date: fields.get("date"),
        emoji: safeText(fields.get("emoji"), 12, "📖") || "📖",
        title: safeText(fields.get("title"), 300),
        description: safeText(fields.get("description"), 300),
        contributions: { Yaoyu: null, Daria: null },
        shareMode: "item"
    };
}

function entryCoreSignature(entry) {
    return JSON.stringify([entry.date, entry.emoji, entry.title, entry.description, entry.createdBy]);
}

function conflictsFor(local, incoming) {
    if (!local) return [];
    const conflicts = [];
    if (entryCoreSignature(local) !== entryCoreSignature(incoming)) conflicts.push("Inhalt");
    for (const identity of ["Yaoyu", "Daria"]) {
        const left = local.contributions[identity];
        const right = incoming.contributions[identity];
        if (left && right && JSON.stringify(left) !== JSON.stringify(right)) conflicts.push(`Bewertung von ${identity}`);
    }
    return conflicts;
}

function mergeEntry(incoming, useShared = false) {
    updateData((data) => {
        const index = data.diaryEntries.findIndex((item) => item.id === incoming.id);
        if (index < 0) {
            data.diaryEntries.push(clone(incoming));
            return data;
        }
        if (useShared) {
            data.diaryEntries[index] = clone(incoming);
            return data;
        }
        const local = sanitizeSharedDiary({ kind: "DIARY", ...data.diaryEntries[index] });
        for (const identity of ["Yaoyu", "Daria"]) {
            if (!local.contributions[identity] && incoming.contributions[identity]) {
                local.contributions[identity] = clone(incoming.contributions[identity]);
            }
        }
        data.diaryEntries[index] = local;
        return data;
    });
}

function saveContribution(entryId, mood, favoriteMoment) {
    updateData((data) => {
        const entry = data.diaryEntries.find((item) => item.id === entryId);
        if (!entry) return data;
        entry.contributions ||= { Yaoyu: null, Daria: null };
        entry.contributions[getCurrentIdentity()] = {
            mood,
            favoriteMoment: safeText(favoriteMoment, 300),
            updatedAt: new Date().toISOString()
        };
        return data;
    });
}

function appendContributionSummary(parent, identity, contribution) {
    const box = document.createElement("div");
    box.className = "contribution";
    const heading = document.createElement("strong");
    heading.textContent = identity;
    const mood = document.createElement("p");
    mood.textContent = contribution?.mood || "Noch keine Bewertung.";
    box.append(heading, mood);
    if (contribution?.favoriteMoment) {
        const moment = document.createElement("p");
        moment.className = "meta";
        moment.textContent = `„${contribution.favoriteMoment}“`;
        box.append(moment);
    }
    parent.append(box);
}

function appendEntryCard(parent, entry, context, rerender) {
    const details = document.createElement("details");
    details.className = "list-card entry-details";
    const summary = document.createElement("summary");
    const heading = document.createElement("div");
    heading.className = "card-heading";
    const title = document.createElement("h3");
    title.className = "emoji-title";
    const emoji = document.createElement("span");
    emoji.className = "emoji";
    emoji.textContent = entry.emoji;
    const titleText = document.createElement("span");
    titleText.textContent = entry.title;
    title.append(emoji, titleText);
    const date = document.createElement("span");
    date.className = "meta";
    date.textContent = formatDate(entry.date);
    heading.append(title, date);
    summary.append(heading);
    details.append(summary);

    if (entry.description) {
        const description = document.createElement("p");
        description.textContent = entry.description;
        details.append(description);
    }
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `Erstellt von ${entry.createdBy}`;
    details.append(meta);

    const contributions = document.createElement("div");
    contributions.className = "contribution-grid";
    appendContributionSummary(contributions, "Yaoyu", entry.contributions.Yaoyu);
    appendContributionSummary(contributions, "Daria", entry.contributions.Daria);
    details.append(contributions);

    const current = entry.contributions[getCurrentIdentity()];
    const form = document.createElement("form");
    form.className = "form-stack";
    form.style.marginTop = "16px";
    const moodLabel = document.createElement("label");
    moodLabel.className = "field";
    const moodText = document.createElement("span");
    moodText.textContent = `Meine Bewertung als ${getCurrentIdentity()}`;
    const select = document.createElement("select");
    select.required = true;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Bewertung wählen";
    select.append(placeholder);
    MOODS.forEach((mood) => {
        const option = document.createElement("option");
        option.value = mood;
        option.textContent = mood;
        select.append(option);
    });
    select.value = current?.mood || "";
    moodLabel.append(moodText, select);

    const momentLabel = document.createElement("label");
    momentLabel.className = "field";
    const momentText = document.createElement("span");
    momentText.textContent = "Mein Lieblingsmoment war ...";
    const textarea = document.createElement("textarea");
    textarea.maxLength = 300;
    textarea.value = current?.favoriteMoment || "";
    momentLabel.append(momentText, textarea);

    const formActions = document.createElement("div");
    formActions.className = "action-row";
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "primary-button";
    save.textContent = current ? "Bewertung ändern" : "Bewertung speichern";
    formActions.append(save);
    form.append(moodLabel, momentLabel, formActions);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!select.value) return;
        saveContribution(entry.id, select.value, textarea.value);
        context.toast("Bewertung wurde lokal gespeichert.");
        rerender();
    });
    details.append(form);

    const actions = document.createElement("div");
    actions.className = "action-row";
    actions.style.marginTop = "15px";
    const share = document.createElement("button");
    share.type = "button";
    share.className = "secondary-button";
    share.textContent = "Tagebucheintrag teilen";
    share.addEventListener("click", () => context.showShare("diary", { ...entry, shareMode: "item" }, "Tagebucheintrag teilen", `${entry.emoji} ${entry.title}`));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger-button";
    remove.textContent = "Lokal löschen";
    remove.addEventListener("click", () => {
        if (!window.confirm("Diesen Tagebucheintrag nur in diesem Browser löschen?")) return;
        updateData((data) => {
            data.diaryEntries = data.diaryEntries.filter((item) => item.id !== entry.id);
            return data;
        });
        context.toast("Tagebucheintrag wurde gelöscht.");
        rerender();
    });
    actions.append(share, remove);
    details.append(actions);
    parent.append(details);
}

export function renderDiary(container, context) {
    const rerender = () => renderDiary(container, context);
    const entries = loadData().diaryEntries.flatMap((item) => {
        try { return [sanitizeSharedDiary({ kind: "DIARY", ...item })]; } catch (error) { return []; }
    }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    container.innerHTML = `
        <header class="page-header page-header-row">
            <div><p class="eyebrow">AKTIVITÄTSTAGEBUCH</p><h1>Unsere Momente</h1><p class="muted">Erinnerungen ohne Fotos – dafür mit euren beiden Eindrücken.</p></div>
            <button id="toggle-diary-form" class="primary-button" type="button">+ Eintrag erstellen</button>
        </header>
        <section id="diary-form-card" class="module-card" hidden>
            <div class="section-heading"><h2>Neuer Eintrag</h2><button id="close-diary-form" class="icon-button" type="button" aria-label="Formular schließen">×</button></div>
            <form id="diary-form" class="form-stack">
                <div class="form-grid">
                    <label class="field"><span>Datum *</span><input name="date" type="date" value="${localToday()}" required></label>
                    <label class="field"><span>Emoji *</span><input name="emoji" type="text" maxlength="12" value="📖" required></label>
                    <label class="field span-two"><span>Titel *</span><input name="title" type="text" maxlength="300" required></label>
                    <label class="field span-two"><span>Kurze Beschreibung</span><textarea name="description" maxlength="300"></textarea></label>
                </div>
                <p id="diary-error" class="error-message" aria-live="polite"></p>
                <div class="action-row"><button class="primary-button" type="submit">Eintrag lokal speichern</button></div>
            </form>
        </section>
        <section style="margin-top:24px">
            <div class="section-heading"><h2>Zeitlinie</h2><span class="badge">${entries.length}</span></div>
            <div id="diary-timeline" class="list-stack"></div>
        </section>
        <div class="action-row" style="margin-top:20px"><button class="secondary-button" type="button" data-route="home">← Zur Startseite</button></div>`;

    const formCard = container.querySelector("#diary-form-card");
    container.querySelector("#toggle-diary-form").addEventListener("click", () => {
        formCard.hidden = false;
        container.querySelector('#diary-form [name="date"]').focus();
    });
    container.querySelector("#close-diary-form").addEventListener("click", () => { formCard.hidden = true; });
    container.querySelector("#diary-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const entry = createEntry(form);
        if (!isIsoDate(entry.date) || !entry.title) {
            container.querySelector("#diary-error").textContent = "Bitte prüfe Datum und Titel.";
            return;
        }
        updateData((data) => {
            data.diaryEntries.push(entry);
            return data;
        });
        context.toast("Tagebucheintrag wurde gespeichert.");
        rerender();
    });

    const timeline = container.querySelector("#diary-timeline");
    if (!entries.length) {
        timeline.innerHTML = '<div class="module-card empty-state">Noch keine Erinnerungen. Erstellt euren ersten Eintrag.</div>';
        return;
    }
    let currentMonth = "";
    entries.forEach((entry) => {
        const [year, month] = entry.date.split("-").map(Number);
        const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
        if (monthLabel !== currentMonth) {
            currentMonth = monthLabel;
            const heading = document.createElement("h3");
            heading.className = "timeline-month";
            heading.textContent = monthLabel;
            timeline.append(heading);
        }
        appendEntryCard(timeline, entry, context, rerender);
    });
}

export function renderDiaryShare(container, rawPayload, context) {
    let entry;
    try {
        entry = sanitizeSharedDiary(rawPayload);
    } catch (error) {
        context.renderShareError();
        return;
    }
    const identity = getCurrentIdentity();
    const localRaw = loadData().diaryEntries.find((item) => item.id === entry.id);
    const local = localRaw ? sanitizeSharedDiary({ kind: "DIARY", ...localRaw }) : null;
    const conflicts = conflictsFor(local, entry);

    container.innerHTML = `
        <header class="page-header"><p class="eyebrow">GETEILTES TAGEBUCH</p><h1>Ein gemeinsamer Moment</h1><p class="muted">Geteilte Texte werden erst nach deiner Bestätigung lokal gespeichert.</p></header>
        <section class="module-card">
            <div class="share-preview"><dl><dt>Geteilt von</dt><dd id="diary-shared-by"></dd><dt>Typ</dt><dd>Tagebuch</dd><dt>Inhalt</dt><dd id="diary-shared-title"></dd><dt>Datum</dt><dd id="diary-shared-date"></dd></dl></div>
            <p id="diary-shared-description"></p>
            <form id="shared-diary-form" class="form-stack" style="margin-top:18px">
                <label class="field"><span>Meine Bewertung als ${identity}</span><select name="mood"><option value="">Später bewerten</option>${MOODS.map((mood) => `<option value="${mood}">${mood}</option>`).join("")}</select></label>
                <label class="field"><span>Mein Lieblingsmoment war ...</span><textarea name="favoriteMoment" maxlength="300"></textarea></label>
            </form>
            <div id="diary-conflict" class="warning-notice" ${conflicts.length ? "" : "hidden"}></div>
            <div class="action-row" style="margin-top:18px">
                <button id="save-shared-diary" class="primary-button" type="button">Lokal speichern</button>
                <button id="respond-shared-diary" class="secondary-button" type="button">Bewertungslink teilen</button>
                <button class="text-button" type="button" data-route="home">Abbrechen</button>
            </div>
            <div id="diary-conflict-actions" class="action-row" hidden style="margin-top:12px">
                <button id="keep-local-diary" class="secondary-button" type="button">Lokale Version behalten</button>
                <button id="use-shared-diary" class="danger-button" type="button">Geteilte Version verwenden</button>
            </div>
        </section>`;

    container.querySelector("#diary-shared-by").textContent = entry.createdBy;
    container.querySelector("#diary-shared-title").textContent = `${entry.emoji} ${entry.title}`;
    container.querySelector("#diary-shared-date").textContent = formatDate(entry.date, { weekday: "long" });
    container.querySelector("#diary-shared-description").textContent = entry.description;
    if (conflicts.length) container.querySelector("#diary-conflict").textContent = `Lokale Unterschiede: ${conflicts.join(", ")}. Wähle beim Speichern eine Version.`;
    const form = container.querySelector("#shared-diary-form");
    form.elements.mood.value = entry.contributions[identity]?.mood || "";
    form.elements.favoriteMoment.value = entry.contributions[identity]?.favoriteMoment || "";

    function applyContribution() {
        if (!form.elements.mood.value) return;
        entry.contributions[identity] = {
            mood: form.elements.mood.value,
            favoriteMoment: safeText(form.elements.favoriteMoment.value, 300),
            updatedAt: new Date().toISOString()
        };
    }
    function save(useShared = false) {
        applyContribution();
        mergeEntry(entry, useShared);
        context.toast("Tagebucheintrag wurde lokal gespeichert.");
        context.clearShare();
    }
    container.querySelector("#save-shared-diary").addEventListener("click", () => {
        if (conflicts.length) {
            container.querySelector("#diary-conflict-actions").hidden = false;
            return;
        }
        save(false);
    });
    container.querySelector("#keep-local-diary").addEventListener("click", () => save(false));
    container.querySelector("#use-shared-diary").addEventListener("click", () => save(true));
    container.querySelector("#respond-shared-diary").addEventListener("click", () => {
        applyContribution();
        entry.shareMode = "response";
        mergeEntry(entry, false);
        context.showShare("diary", entry, "Bewertung eines Moments", `${identity} hat ${entry.emoji} ${entry.title} bewertet.`);
    });
}
