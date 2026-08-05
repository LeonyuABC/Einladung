import {
    getCurrentIdentity,
    isIdentity,
    isIsoDate,
    loadData,
    localToday,
    safeText,
    updateData
} from "./storage.js";

export const EMOJI_GROUPS = [{ title: "Alle Emojis", items: [
    "🥰", "😍", "😘", "😚", "❤️", "💕", "💗", "💖", "🫂", "🤗",
    "🫶", "👫", "😀", "😃", "😄", "😁", "😊", "🙂", "🥳", "🤩",
    "😎", "😌", "✨", "🌞", "💪", "🙌", "😐", "😶", "🤔", "🙃",
    "🫠", "😅", "😬", "🤷", "📚", "💻", "✍️", "☕", "🥱", "😴",
    "😪", "😮‍💨", "🤯", "😰", "😟", "😔", "😢", "😭", "🥺", "💔",
    "❤️‍🩹", "😠", "😡", "😤", "🙄", "🤒", "🤕", "🤧", "🛌", "🙏"
] }];

export const STATUS_GROUPS = [{ title: "Alle Status", items: [
    "Glücklich", "Ich vermisse dich", "Ich möchte dich sehen", "Ich möchte dich küssen",
    "Ich möchte dich umarmen", "Ich möchte mit dir reden", "Ich brauche deine Nähe",
    "Ruhig", "Entspannt", "Normal", "Gemischte Gefühle", "Ich lerne", "Ich arbeite",
    "Heute sehr beschäftigt", "Etwas müde", "Sehr müde", "Sehr gestresst", "Etwas traurig",
    "Ich brauche Trost", "Ich fühle mich nicht gut"
] }];

const IDENTITIES = ["Yaoyu", "Daria"];
const MOOD_RESPONSE_EMOJIS = ["❤️", "🫂", "😊", "🥺", "💪", "😘"];
const ALL_STATUSES = new Set(STATUS_GROUPS.flatMap((group) => group.items));

function sanitizeMoodResponse(value) {
    if (!value || typeof value !== "object") return null;
    const emoji = MOOD_RESPONSE_EMOJIS.includes(value.emoji) ? value.emoji : "";
    const message = safeText(value.message, 180);
    if (!emoji && !message) return null;
    return {
        emoji,
        message,
        respondedAt: safeText(value.respondedAt, 50) || new Date().toISOString()
    };
}

export function sanitizeMood(value) {
    if (!value || typeof value !== "object") return null;
    const date = safeText(value.date, 10);
    const identity = safeText(value.identity, 20);
    const emoji = safeText(value.emoji, 16);
    if (!isIsoDate(date) || !isIdentity(identity) || !emoji) return null;
    const choices = Array.isArray(value.choices)
        ? [...new Set(value.choices.map((item) => safeText(item, 80)).filter(Boolean))].slice(0, 12)
        : [];
    return {
        id: `${date}-${identity.toLowerCase()}`,
        date,
        identity,
        emoji,
        choices,
        customText: safeText(value.customText, 160),
        note: safeText(value.note, 700),
        responses: {
            Yaoyu: sanitizeMoodResponse(value.responses?.Yaoyu),
            Daria: sanitizeMoodResponse(value.responses?.Daria)
        },
        updatedAt: safeText(value.updatedAt, 50) || new Date().toISOString()
    };
}

export function moodForDate(identity, date, data = loadData()) {
    const matches = (data.moods || [])
        .map(sanitizeMood)
        .filter((item) => item && item.date === date && item.identity === identity);
    return matches[matches.length - 1] || null;
}

function formatDateLabel(date) {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function saveMoodResponse(date, moodOwner, response) {
    updateData((data) => {
        const index = (data.moods || []).findIndex((item) => {
            const clean = sanitizeMood(item);
            return clean && clean.date === date && clean.identity === moodOwner;
        });
        if (index < 0) return data;
        const clean = sanitizeMood(data.moods[index]);
        clean.responses[getCurrentIdentity()] = sanitizeMoodResponse(response);
        clean.updatedAt = new Date().toISOString();
        data.moods[index] = clean;
        return data;
    });
}

function appendMoodResponseForm(card, mood, date, context, onChange) {
    const identity = getCurrentIdentity();
    if (!mood || mood.identity === identity) return;
    const existing = mood.responses?.[identity] || null;
    let selectedEmoji = existing?.emoji || "";

    const form = document.createElement("form");
    form.className = "mood-response-form";
    const heading = document.createElement("h4");
    heading.textContent = existing ? "Deine Antwort bearbeiten" : "Darauf antworten";
    const emojiRow = document.createElement("div");
    emojiRow.className = "mood-response-emojis";
    const message = document.createElement("textarea");
    message.maxLength = 180;
    message.rows = 2;
    message.placeholder = "Eine kleine Nachricht ...";
    message.value = existing?.message || "";
    const error = document.createElement("p");
    error.className = "error-message";

    const redraw = () => {
        emojiRow.replaceChildren();
        MOOD_RESPONSE_EMOJIS.forEach((emoji) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `mood-response-emoji${selectedEmoji === emoji ? " selected" : ""}`;
            button.textContent = emoji;
            button.addEventListener("click", () => {
                selectedEmoji = selectedEmoji === emoji ? "" : emoji;
                redraw();
            });
            emojiRow.append(button);
        });
    };

    const actions = document.createElement("div");
    actions.className = "action-row";
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "primary-button";
    save.textContent = existing ? "Antwort aktualisieren" : "Antwort speichern";
    actions.append(save);
    if (existing) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "text-button";
        remove.textContent = "Antwort entfernen";
        remove.addEventListener("click", () => {
            saveMoodResponse(date, mood.identity, null);
            context.toast("Deine Antwort wurde entfernt.");
            onChange();
        });
        actions.append(remove);
    }

    form.append(heading, emojiRow, message, error, actions);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = safeText(message.value, 180);
        if (!selectedEmoji && !text) {
            error.textContent = "Bitte wähle ein Emoji oder schreibe eine Nachricht.";
            return;
        }
        saveMoodResponse(date, mood.identity, {
            emoji: selectedEmoji,
            message: text,
            respondedAt: new Date().toISOString()
        });
        context.toast("Deine Antwort wurde gespeichert.");
        onChange();
    });
    redraw();
    card.append(form);
}

function createSummaryCard(identity, mood, date, context, onChange) {
    const card = document.createElement("article");
    card.className = `mood-person-card mood-person-${identity.toLowerCase()}`;
    const heading = document.createElement("div");
    heading.className = "mood-card-heading";
    const title = document.createElement("h3");
    title.textContent = identity;
    heading.append(title);

    // Nur der eigene Stimmungseintrag darf gelöscht werden.
    if (mood && identity === getCurrentIdentity()) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "mood-inline-delete";
        remove.textContent = "Löschen";
        remove.addEventListener("click", () => {
            if (!window.confirm(`Möchtest du deinen Stimmungseintrag für ${formatDateLabel(date)} wirklich löschen?`)) return;
            updateData((data) => {
                data.moods = (data.moods || []).filter((entry) => {
                    const clean = sanitizeMood(entry);
                    return !(clean && clean.date === date && clean.identity === identity);
                });
                return data;
            });
            context.toast("Dein Stimmungseintrag wurde gelöscht.");
            onChange();
        });
        heading.append(remove);
    }
    card.append(heading);
    if (!mood) {
        const empty = document.createElement("p");
        empty.className = "mood-empty";
        empty.textContent = "Noch kein Eintrag";
        card.append(empty);
        return card;
    }
    const emoji = document.createElement("div");
    emoji.className = "mood-summary-emoji";
    emoji.textContent = mood.emoji;
    card.append(emoji);
    const details = [...mood.choices];
    if (mood.customText) details.push(mood.customText);
    if (details.length) {
        const tags = document.createElement("div");
        tags.className = "mood-summary-tags";
        details.forEach((text) => {
            const tag = document.createElement("span");
            tag.textContent = text;
            tags.append(tag);
        });
        card.append(tags);
    }
    if (mood.note) {
        const note = document.createElement("p");
        note.className = "mood-summary-note";
        note.textContent = mood.note;
        card.append(note);
    }
    const responses = IDENTITIES.filter((person) => mood.responses?.[person]);
    if (responses.length) {
        const list = document.createElement("div");
        list.className = "mood-response-list";
        responses.forEach((person) => {
            const response = mood.responses[person];
            const row = document.createElement("div");
            row.className = "mood-response-summary";
            const sender = document.createElement("strong");
            sender.textContent = person;
            const content = document.createElement("span");
            content.textContent = [response.emoji, response.message].filter(Boolean).join(" ");
            row.append(sender, content);
            list.append(row);
        });
        card.append(list);
    }
    appendMoodResponseForm(card, mood, date, context, onChange);
    return card;
}

function renderChoiceSections(parent, groups, selectedValues, className, onToggle) {
    const grid = document.createElement("div");
    grid.className = `${className} mood-flat-picker`;
    groups.flatMap((group) => group.items).forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className.includes("emoji") ? "mood-emoji-button" : "mood-text-button";
        button.textContent = item;
        button.classList.toggle("selected", selectedValues.has(item));
        button.setAttribute("aria-pressed", String(selectedValues.has(item)));
        button.addEventListener("click", () => onToggle(item));
        grid.append(button);
    });
    parent.append(grid);
}

export function renderMoodEditor(container, date, context, onChange) {
    const identity = getCurrentIdentity();
    const data = loadData();
    const today = localToday();
    const isFuture = date > today;
    const ownMood = moodForDate(identity, date, data);
    const selectedEmoji = { value: ownMood?.emoji || "" };
    const selectedChoices = new Set(ownMood?.choices || []);

    container.innerHTML = `
        <div class="section-heading mood-editor-heading">
            <div>
                <p class="eyebrow">${date === today ? "HEUTE" : "AUSGEWÄHLTER TAG"}</p>
                <h2>${formatDateLabel(date)}</h2>
            </div>
            ${isFuture ? '<span class="badge">Stimmung erst an diesem Tag</span>' : ""}
        </div>
        <div id="selected-mood-cards" class="mood-person-grid"></div>
        <form id="inline-mood-form" class="inline-mood-form" ${isFuture ? "hidden" : ""}>
            <div class="mood-editor-tabs">
                <section class="mood-editor-block">
                    <h3>Emoji</h3>
                    <div id="inline-emoji-groups"></div>
                </section>
                <section class="mood-editor-block">
                    <h3>Status</h3>
                    <div id="inline-status-groups"></div>
                </section>
                <section class="mood-editor-block mood-editor-notes">
                    <h3>Eigener Text</h3>
                    <label class="field"><span>Eigener Status</span><input name="customText" maxlength="160" placeholder="Etwas anderes ..."></label>
                    <label class="field"><span>Notiz</span><textarea name="note" maxlength="700" rows="4" placeholder="Wenn du noch etwas sagen möchtest ..."></textarea></label>
                </section>
            </div>
            <p id="inline-mood-error" class="error-message" aria-live="polite"></p>
            <div class="action-row"><button class="primary-button" type="submit">Stimmung von ${identity} speichern</button></div>
        </form>`;

    const cards = container.querySelector("#selected-mood-cards");
    IDENTITIES.forEach((person) => cards.append(createSummaryCard(person, moodForDate(person, date, data), date, context, onChange)));
    if (isFuture) return;

    const form = container.querySelector("#inline-mood-form");
    form.elements.customText.value = ownMood?.customText || "";
    form.elements.note.value = ownMood?.note || "";
    const emojiGroups = container.querySelector("#inline-emoji-groups");
    const statusGroups = container.querySelector("#inline-status-groups");

    const redrawEmoji = () => {
        emojiGroups.replaceChildren();
        const selected = new Set(selectedEmoji.value ? [selectedEmoji.value] : []);
        renderChoiceSections(emojiGroups, EMOJI_GROUPS, selected, "mood-emoji-grid", (emoji) => {
            selectedEmoji.value = emoji;
            redrawEmoji();
        });
    };
    const redrawStatuses = () => {
        statusGroups.replaceChildren();
        renderChoiceSections(statusGroups, STATUS_GROUPS, selectedChoices, "mood-text-grid", (status) => {
            if (selectedChoices.has(status)) selectedChoices.delete(status);
            else selectedChoices.add(status);
            redrawStatuses();
        });
        // Alte Statuswerte bleiben sichtbar und erhalten, auch wenn sie nicht mehr in der neuen Liste stehen.
        const legacy = [...selectedChoices].filter((item) => !ALL_STATUSES.has(item));
        if (legacy.length) {
            const hint = document.createElement("p");
            hint.className = "muted small-text";
            hint.textContent = `Ältere Auswahl bleibt erhalten: ${legacy.join(", ")}`;
            statusGroups.append(hint);
        }
    };
    redrawEmoji();
    redrawStatuses();

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const error = container.querySelector("#inline-mood-error");
        if (!selectedEmoji.value) {
            error.textContent = "Bitte wähle ein Emoji aus.";
            return;
        }
        const entry = sanitizeMood({
            date,
            identity,
            emoji: selectedEmoji.value,
            choices: [...selectedChoices],
            customText: form.elements.customText.value,
            note: form.elements.note.value,
            responses: ownMood?.responses || { Yaoyu: null, Daria: null },
            updatedAt: new Date().toISOString()
        });
        updateData((current) => {
            current.moods = (current.moods || []).filter((item) => {
                const clean = sanitizeMood(item);
                return !(clean && clean.date === date && clean.identity === identity);
            });
            current.moods.push(entry);
            return current;
        });
        context.toast("Deine Stimmung wurde gespeichert.");
        onChange();
    });
}

// Rückwärtskompatible Exporte für alte Links oder Module.
export function renderHomeMoods(container) {
    const data = loadData();
    container.replaceChildren();
    IDENTITIES.forEach((identity) => container.append(createSummaryCard(identity, moodForDate(identity, localToday(), data), localToday(), { toast() {} }, () => {})));
}

export function renderMood(container, context) {
    renderMoodEditor(container, localToday(), context, () => renderMood(container, context));
}

export const EMOJIS = EMOJI_GROUPS.flatMap((group) => group.items);
export const TEXT_CHOICES = STATUS_GROUPS.flatMap((group) => group.items);
