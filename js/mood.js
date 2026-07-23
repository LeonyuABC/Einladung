import {
    getCurrentIdentity,
    isIdentity,
    isIsoDate,
    loadData,
    localToday,
    safeText,
    updateData
} from "./storage.js";

const EMOJIS = [
    "❤️", "🥰", "😊", "😆", "😌", "😎", "😐",
    "😑", "😴", "🫠", "🤔", "😶", "🥺", "😔",
    "😢", "😭", "😡", "😤", "😰", "🤯", "🤒"
];

const TEXT_CHOICES = [
    "Glücklich",
    "Gelangweilt",
    "Gerührt",
    "Traurig",
    "Wütend",
    "Ich möchte etwas Ruhe",
    "Ich möchte eine Umarmung",
    "Ich möchte reden",
    "Ich möchte einen Kuss",
    "Ich vermisse dich",
    "Ich möchte schlafen"
];

const IDENTITIES = ["Yaoyu", "Daria"];
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MOOD_RESPONSE_EMOJIS = ["❤️", "🫂", "😊", "🥺", "💪", "😘"];

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

function sanitizeMood(value) {
    if (!value || typeof value !== "object") return null;
    const date = safeText(value.date, 10);
    const identity = safeText(value.identity, 20);
    const emoji = safeText(value.emoji, 12);
    if (!isIsoDate(date) || !isIdentity(identity) || !EMOJIS.includes(emoji)) return null;

    const choices = Array.isArray(value.choices)
        ? [...new Set(value.choices.map((item) => safeText(item, 80)).filter((item) => TEXT_CHOICES.includes(item)))]
        : [];

    return {
        id: `${date}-${identity.toLowerCase()}`,
        date,
        identity,
        emoji,
        choices,
        customText: safeText(value.customText, 120),
        note: safeText(value.note, 500),
        responses: {
            Yaoyu: sanitizeMoodResponse(value.responses?.Yaoyu),
            Daria: sanitizeMoodResponse(value.responses?.Daria)
        },
        updatedAt: safeText(value.updatedAt, 50) || new Date().toISOString()
    };
}

function moodForDate(identity, date, data = loadData()) {
    const matches = (data.moods || [])
        .map(sanitizeMood)
        .filter((item) => item && item.date === date && item.identity === identity);
    return matches[matches.length - 1] || null;
}

function dateFromIso(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function isoFromParts(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatSelectedDate(value) {
    return dateFromIso(value).toLocaleDateString("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function addMoodDetails(container, mood) {
    if (!mood) {
        const empty = document.createElement("p");
        empty.className = "mood-empty";
        empty.textContent = "Noch nichts ausgewählt";
        container.append(empty);
        return;
    }

    const emoji = document.createElement("div");
    emoji.className = "mood-summary-emoji";
    emoji.textContent = mood.emoji;
    container.append(emoji);

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
        container.append(tags);
    }

    if (mood.note) {
        const note = document.createElement("p");
        note.className = "mood-summary-note";
        note.textContent = mood.note;
        container.append(note);
    }

    const responses = IDENTITIES.filter((identity) => mood.responses?.[identity]);
    if (responses.length) {
        const responseList = document.createElement("div");
        responseList.className = "mood-response-list";
        responses.forEach((identity) => {
            const response = mood.responses[identity];
            const item = document.createElement("div");
            item.className = "mood-response-summary";
            const sender = document.createElement("strong");
            sender.textContent = identity;
            const content = document.createElement("span");
            content.textContent = [response.emoji, response.message].filter(Boolean).join(" ");
            item.append(sender, content);
            responseList.append(item);
        });
        container.append(responseList);
    }
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
        data.moods[index] = clean;
        return data;
    });
}

function appendMoodResponseForm(card, mood, date, context, onChanged) {
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
    message.name = "message";
    message.maxLength = 180;
    message.rows = 2;
    message.placeholder = "Eine kleine Nachricht ...";
    message.value = existing?.message || "";
    const error = document.createElement("p");
    error.className = "error-message";
    error.setAttribute("aria-live", "polite");

    function refreshEmojiButtons() {
        emojiRow.replaceChildren(...MOOD_RESPONSE_EMOJIS.map((emoji) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `mood-response-emoji${selectedEmoji === emoji ? " selected" : ""}`;
            button.textContent = emoji;
            button.setAttribute("aria-label", `Mit ${emoji} antworten`);
            button.addEventListener("click", () => {
                selectedEmoji = selectedEmoji === emoji ? "" : emoji;
                error.textContent = "";
                refreshEmojiButtons();
            });
            return button;
        }));
    }

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
            onChanged();
        });
        actions.append(remove);
    }

    form.append(heading, emojiRow, message, error, actions);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const responseMessage = safeText(message.value, 180);
        if (!selectedEmoji && !responseMessage) {
            error.textContent = "Bitte wähle ein Emoji oder schreibe eine kurze Nachricht.";
            return;
        }
        saveMoodResponse(date, mood.identity, {
            emoji: selectedEmoji,
            message: responseMessage,
            respondedAt: new Date().toISOString()
        });
        context.toast("Deine Antwort wird synchronisiert.");
        onChanged();
    });
    refreshEmojiButtons();
    card.append(form);
}

function renderMoodCards(container, date, data = loadData(), options = {}) {
    container.replaceChildren();
    IDENTITIES.forEach((identity) => {
        const card = document.createElement("article");
        card.className = `mood-person-card mood-person-${identity.toLowerCase()}`;

        const heading = document.createElement("h3");
        heading.textContent = identity;
        card.append(heading);

        const mood = moodForDate(identity, date, data);
        addMoodDetails(card, mood);
        if (options.interactive && options.context && typeof options.onChanged === "function") {
            appendMoodResponseForm(card, mood, date, options.context, options.onChanged);
        }
        container.append(card);
    });
}

export function renderHomeMoods(container) {
    renderMoodCards(container, localToday());
}

function makeEmojiButton(emoji, selectedEmoji, onSelect) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mood-emoji-button";
    button.textContent = emoji;
    button.setAttribute("aria-label", `Emoji ${emoji}`);
    button.setAttribute("aria-pressed", String(emoji === selectedEmoji));
    button.classList.toggle("selected", emoji === selectedEmoji);
    button.addEventListener("click", () => onSelect(emoji));
    return button;
}

function makeTextButton(text, selectedChoices, onToggle) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mood-text-button";
    button.textContent = text;
    button.setAttribute("aria-pressed", String(selectedChoices.has(text)));
    button.classList.toggle("selected", selectedChoices.has(text));
    button.addEventListener("click", () => onToggle(text));
    return button;
}

function makeCalendarMood(identity, mood) {
    const row = document.createElement("span");
    row.className = `mood-calendar-person mood-calendar-${identity.toLowerCase()}`;
    row.setAttribute("aria-label", `${identity}: ${mood?.emoji || "kein Eintrag"}`);

    const initial = document.createElement("b");
    initial.textContent = identity[0];
    const emoji = document.createElement("span");
    emoji.textContent = mood?.emoji || "·";
    row.append(initial, emoji);
    return row;
}

export function renderMood(container, context) {
    const identity = getCurrentIdentity();
    const today = localToday();
    const todayDate = dateFromIso(today);
    let selectedDate = today;
    let displayedMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    let selectedEmoji = "";
    const selectedChoices = new Set();

    container.innerHTML = `
        <header class="page-header page-header-row">
            <div>
                <p class="eyebrow">STIMMUNGSKALENDER</p>
                <h1>Eure täglichen Stimmungen</h1>
                <p class="muted">Wählt einen Tag aus und schaut, wie es euch ging.</p>
            </div>
            <button class="secondary-button" type="button" data-route="home">← Zur Startseite</button>
        </header>

        <section class="mood-calendar-section module-card" aria-labelledby="mood-calendar-title">
            <div class="mood-calendar-controls">
                <button id="mood-previous-month" class="icon-button" type="button" aria-label="Vorheriger Monat">←</button>
                <div>
                    <h2 id="mood-calendar-title"></h2>
                    <button id="mood-today" class="text-button" type="button">Heute</button>
                </div>
                <button id="mood-next-month" class="icon-button" type="button" aria-label="Nächster Monat">→</button>
            </div>
            <div id="mood-calendar-grid" class="mood-calendar-grid" aria-label="Monatskalender"></div>
            <div class="mood-calendar-legend" aria-label="Personen">
                <span class="mood-calendar-yaoyu"><b>Y</b> Yaoyu</span>
                <span class="mood-calendar-daria"><b>D</b> Daria</span>
            </div>
        </section>

        <section class="mood-current-section" aria-labelledby="mood-current-title">
            <div class="section-heading">
                <div>
                    <p id="mood-selected-label" class="eyebrow"></p>
                    <h2 id="mood-current-title"></h2>
                </div>
            </div>
            <div id="mood-current-grid" class="mood-person-grid"></div>
        </section>

        <form id="mood-form" class="mood-form">
            <section class="mood-column module-card">
                <div class="mood-column-number">1</div>
                <h2>Emoji</h2>
                <div id="mood-emoji-grid" class="mood-emoji-grid" role="group" aria-label="Ein Emoji auswählen"></div>
                <p id="mood-emoji-error" class="error-message" aria-live="polite"></p>
            </section>

            <section class="mood-column module-card">
                <div class="mood-column-number">2</div>
                <h2>Was ist los?</h2>
                <div id="mood-text-grid" class="mood-text-grid" role="group" aria-label="Texte auswählen"></div>
            </section>

            <section class="mood-column module-card">
                <div class="mood-column-number">3</div>
                <h2>Optional</h2>
                <label class="field">
                    <span>Eigener Text</span>
                    <input id="mood-custom-text" name="customText" maxlength="120" placeholder="Etwas anderes ...">
                </label>
                <label class="field">
                    <span>Notiz</span>
                    <textarea id="mood-note" name="note" maxlength="500" rows="5" placeholder="Wenn du noch etwas sagen möchtest ..."></textarea>
                </label>
            </section>

            <div class="mood-save-row">
                <button id="mood-delete-button" class="danger-button" type="button" hidden>Eintrag löschen</button>
                <button id="mood-save-button" class="primary-button" type="submit"></button>
            </div>
        </form>`;

    const calendarTitle = container.querySelector("#mood-calendar-title");
    const calendarGrid = container.querySelector("#mood-calendar-grid");
    const previousMonthButton = container.querySelector("#mood-previous-month");
    const nextMonthButton = container.querySelector("#mood-next-month");
    const currentGrid = container.querySelector("#mood-current-grid");
    const selectedLabel = container.querySelector("#mood-selected-label");
    const currentTitle = container.querySelector("#mood-current-title");
    const emojiGrid = container.querySelector("#mood-emoji-grid");
    const textGrid = container.querySelector("#mood-text-grid");
    const customInput = container.querySelector("#mood-custom-text");
    const noteInput = container.querySelector("#mood-note");
    const emojiError = container.querySelector("#mood-emoji-error");
    const deleteButton = container.querySelector("#mood-delete-button");
    const saveButton = container.querySelector("#mood-save-button");

    const refreshEmojiButtons = () => {
        emojiGrid.replaceChildren(...EMOJIS.map((emoji) => makeEmojiButton(emoji, selectedEmoji, (nextEmoji) => {
            selectedEmoji = nextEmoji;
            emojiError.textContent = "";
            refreshEmojiButtons();
        })));
    };

    const refreshTextButtons = () => {
        textGrid.replaceChildren(...TEXT_CHOICES.map((text) => makeTextButton(text, selectedChoices, (choice) => {
            if (selectedChoices.has(choice)) selectedChoices.delete(choice);
            else selectedChoices.add(choice);
            refreshTextButtons();
        })));
    };

    const renderCalendar = () => {
        const data = loadData();
        const year = displayedMonth.getFullYear();
        const monthIndex = displayedMonth.getMonth();
        const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const fragments = [];

        calendarTitle.textContent = displayedMonth.toLocaleDateString("de-DE", {
            month: "long",
            year: "numeric"
        });

        WEEKDAYS.forEach((weekday) => {
            const label = document.createElement("div");
            label.className = "mood-calendar-weekday";
            label.textContent = weekday;
            fragments.push(label);
        });

        for (let index = 0; index < firstWeekday; index += 1) {
            const empty = document.createElement("div");
            empty.className = "mood-calendar-day empty";
            empty.setAttribute("aria-hidden", "true");
            fragments.push(empty);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = isoFromParts(year, monthIndex, day);
            const yaoyuMood = moodForDate("Yaoyu", date, data);
            const dariaMood = moodForDate("Daria", date, data);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "mood-calendar-day";
            button.classList.toggle("today", date === today);
            button.classList.toggle("selected", date === selectedDate);
            button.classList.toggle("has-entry", Boolean(yaoyuMood || dariaMood));
            button.disabled = date > today;
            button.setAttribute("aria-label", `${formatSelectedDate(date)} auswählen`);

            const dayNumber = document.createElement("span");
            dayNumber.className = "mood-calendar-number";
            dayNumber.textContent = String(day);
            const people = document.createElement("span");
            people.className = "mood-calendar-people";
            people.append(
                makeCalendarMood("Yaoyu", yaoyuMood),
                makeCalendarMood("Daria", dariaMood)
            );
            button.append(dayNumber, people);
            button.addEventListener("click", () => {
                selectedDate = date;
                displayedMonth = new Date(year, monthIndex, 1);
                loadSelectedDate();
            });
            fragments.push(button);
        }

        calendarGrid.replaceChildren(...fragments);
        nextMonthButton.disabled = monthKey(displayedMonth) >= monthKey(todayDate);
    };

    const loadSelectedDate = () => {
        const existing = moodForDate(identity, selectedDate);
        selectedEmoji = existing?.emoji || "";
        selectedChoices.clear();
        (existing?.choices || []).forEach((choice) => selectedChoices.add(choice));
        customInput.value = existing?.customText || "";
        noteInput.value = existing?.note || "";
        emojiError.textContent = "";

        const isToday = selectedDate === today;
        selectedLabel.textContent = isToday ? "HEUTE" : "AUSGEWÄHLTER TAG";
        currentTitle.textContent = isToday ? "Heute bei euch" : formatSelectedDate(selectedDate);
        deleteButton.hidden = !existing;
        saveButton.textContent = isToday ? "Für heute speichern" : "Für diesen Tag speichern";
        renderMoodCards(currentGrid, selectedDate, loadData(), {
            interactive: true,
            context,
            onChanged: loadSelectedDate
        });
        refreshEmojiButtons();
        refreshTextButtons();
        renderCalendar();
    };

    previousMonthButton.addEventListener("click", () => {
        displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
        renderCalendar();
    });

    nextMonthButton.addEventListener("click", () => {
        if (monthKey(displayedMonth) >= monthKey(todayDate)) return;
        displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
        renderCalendar();
    });

    container.querySelector("#mood-today").addEventListener("click", () => {
        selectedDate = today;
        displayedMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
        loadSelectedDate();
    });

    deleteButton.addEventListener("click", () => {
        const existing = moodForDate(identity, selectedDate);
        if (!existing) return;
        const dateLabel = selectedDate === today ? "heute" : formatSelectedDate(selectedDate);
        if (!window.confirm(`Möchtest du deinen Eintrag für ${dateLabel} wirklich löschen?`)) return;

        updateData((data) => {
            data.moods = (data.moods || []).filter((item) => {
                const clean = sanitizeMood(item);
                return !(clean && clean.date === selectedDate && clean.identity === identity);
            });
        });

        loadSelectedDate();
        context.toast("Dein Eintrag wurde gelöscht.");
    });

    container.querySelector("#mood-form").addEventListener("submit", (event) => {
        event.preventDefault();
        if (!selectedEmoji) {
            emojiError.textContent = "Bitte wähle ein Emoji aus.";
            emojiGrid.querySelector("button")?.focus();
            return;
        }

        const date = selectedDate;
        const existing = moodForDate(identity, date);
        const entry = sanitizeMood({
            id: `${date}-${identity.toLowerCase()}`,
            date,
            identity,
            emoji: selectedEmoji,
            choices: [...selectedChoices],
            customText: customInput.value,
            note: noteInput.value,
            responses: existing?.responses || { Yaoyu: null, Daria: null },
            updatedAt: new Date().toISOString()
        });

        updateData((data) => {
            data.moods = (data.moods || []).filter((item) => {
                const clean = sanitizeMood(item);
                return !(clean && clean.date === date && clean.identity === identity);
            });
            data.moods.push(entry);
        });

        loadSelectedDate();
        context.toast(date === today
            ? "Deine Stimmung wurde gespeichert."
            : "Deine Stimmung für diesen Tag wurde gespeichert.");
    });

    loadSelectedDate();
}

export { EMOJIS, TEXT_CHOICES, sanitizeMood };