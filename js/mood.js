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
        updatedAt: safeText(value.updatedAt, 50) || new Date().toISOString()
    };
}

function todayMood(identity, data = loadData()) {
    const date = localToday();
    const matches = (data.moods || [])
        .map(sanitizeMood)
        .filter((item) => item && item.date === date && item.identity === identity);
    return matches[matches.length - 1] || null;
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
}

export function renderHomeMoods(container) {
    const data = loadData();
    container.replaceChildren();
    ["Yaoyu", "Daria"].forEach((identity) => {
        const card = document.createElement("article");
        card.className = `mood-person-card mood-person-${identity.toLowerCase()}`;

        const heading = document.createElement("h3");
        heading.textContent = identity;
        card.append(heading);

        addMoodDetails(card, todayMood(identity, data));
        container.append(card);
    });
}

function renderCurrentMoods(container) {
    const data = loadData();
    container.replaceChildren();
    ["Yaoyu", "Daria"].forEach((identity) => {
        const card = document.createElement("article");
        card.className = `mood-person-card mood-person-${identity.toLowerCase()}`;

        const heading = document.createElement("h3");
        heading.textContent = identity;
        card.append(heading);
        addMoodDetails(card, todayMood(identity, data));
        container.append(card);
    });
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

export function renderMood(container, context) {
    const identity = getCurrentIdentity();
    const existing = todayMood(identity);
    let selectedEmoji = existing?.emoji || "";
    const selectedChoices = new Set(existing?.choices || []);

    container.innerHTML = `
        <header class="page-header page-header-row">
            <div>
                <p class="eyebrow">HEUTE</p>
                <h1>Wie fühlst du dich?</h1>
                <p class="muted"><span id="mood-active-person"></span> wählt für heute.</p>
            </div>
            <button class="secondary-button" type="button" data-route="home">← Zur Startseite</button>
        </header>

        <section class="mood-current-section" aria-labelledby="mood-current-title">
            <div class="section-heading">
                <h2 id="mood-current-title">Heute bei euch</h2>
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
                <h2>Was ist heute los?</h2>
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
                <button class="primary-button" type="submit">Für heute speichern</button>
            </div>
        </form>`;

    container.querySelector("#mood-active-person").textContent = identity;
    const currentGrid = container.querySelector("#mood-current-grid");
    const emojiGrid = container.querySelector("#mood-emoji-grid");
    const textGrid = container.querySelector("#mood-text-grid");
    const customInput = container.querySelector("#mood-custom-text");
    const noteInput = container.querySelector("#mood-note");
    const emojiError = container.querySelector("#mood-emoji-error");

    customInput.value = existing?.customText || "";
    noteInput.value = existing?.note || "";
    renderCurrentMoods(currentGrid);

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

    refreshEmojiButtons();
    refreshTextButtons();

    container.querySelector("#mood-form").addEventListener("submit", (event) => {
        event.preventDefault();
        if (!selectedEmoji) {
            emojiError.textContent = "Bitte wähle ein Emoji aus.";
            emojiGrid.querySelector("button")?.focus();
            return;
        }

        const date = localToday();
        const entry = sanitizeMood({
            id: `${date}-${identity.toLowerCase()}`,
            date,
            identity,
            emoji: selectedEmoji,
            choices: [...selectedChoices],
            customText: customInput.value,
            note: noteInput.value,
            updatedAt: new Date().toISOString()
        });

        updateData((data) => {
            data.moods = (data.moods || []).filter((item) => {
                const clean = sanitizeMood(item);
                return !(clean && clean.date === date && clean.identity === identity);
            });
            data.moods.push(entry);
        });

        renderCurrentMoods(currentGrid);
        context.toast("Deine Stimmung wurde gespeichert.");
    });
}

export { EMOJIS, TEXT_CHOICES, sanitizeMood };
