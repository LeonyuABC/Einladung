import {
    clone,
    formatDate,
    generateId,
    getCurrentIdentity,
    isIdentity,
    isIsoDate,
    loadData,
    safeText,
    updateData
} from "./storage.js";
import { isPlainObject } from "./share.js";

export const IDEA_TYPES = [
    "💭 Idee",
    "⭐ Wunsch",
    "💌 Einladung",
    "✈️ Reise",
    "🎉 Aktivität",
    "🎁 Überraschung",
    "🍽️ Essen",
    "🏠 Gemeinsam zu Hause"
];
const TYPE_EMOJI = Object.fromEntries(IDEA_TYPES.map((type) => [type, type.split(" ")[0]]));


export const IDEA_EMOJI_GROUPS = [
    { title: "Reise & draußen", items: ["✈️", "🚆", "🚗", "🚌", "🏖️", "🏔️", "🏕️", "🌲", "🌊", "🚶", "🚲", "🛶", "🏊", "⛷️", "🗺️"] },
    { title: "Date & Romantik", items: ["❤️", "💕", "💌", "🌹", "🕯️", "🌙", "🌅", "🌇", "👫", "🫂", "💍", "📷"] },
    { title: "Essen & Trinken", items: ["🍝", "🍕", "🍣", "🍜", "🍰", "🧁", "🍫", "☕", "🫖", "🍳", "🥘", "🥐", "🍓", "🥂"] },
    { title: "Unterhaltung & Kultur", items: ["🎬", "🍿", "🎭", "🎵", "🎤", "🎨", "🖼️", "📚", "🎮", "🎳", "🎡", "🎢", "🧩"] },
    { title: "Alltag & gemeinsames Leben", items: ["🏠", "🛋️", "🛍️", "🎁", "🧹", "🍳", "📖", "💻", "🪴", "🐕", "💡", "✅"] }
];

const RESPONSE_OPTIONS = [
    { status: "ACCEPTED", label: "✓ Passt für mich", short: "✓" },
    { status: "MAYBE", label: "? Vielleicht", short: "?" },
    { status: "DECLINED", label: "× Passt nicht für mich", short: "×" },
    { status: "OTHER_DATE", label: "↻ Anderen Termin vorschlagen", short: "↻" }
];

function emptyResponses() {
    return { Yaoyu: null, Daria: null };
}

function sanitizeResponse(value) {
    if (typeof value === "string") {
        if (value === "HEART") return { status: "ACCEPTED", suggestedDate: "", note: "", updatedAt: "" };
        if (value === "NOT_INTERESTED") return { status: "DECLINED", suggestedDate: "", note: "", updatedAt: "" };
        return null;
    }
    if (!isPlainObject(value) || !["ACCEPTED", "MAYBE", "DECLINED", "OTHER_DATE"].includes(value.status)) return null;
    return {
        status: value.status,
        suggestedDate: value.status === "OTHER_DATE" && isIsoDate(value.suggestedDate) ? value.suggestedDate : "",
        note: safeText(value.note, 300),
        updatedAt: safeText(value.updatedAt, 50)
    };
}

function sanitizeComment(value) {
    if (!isPlainObject(value) || !isIdentity(value.author)) return null;
    const id = safeText(value.id, 1000);
    const text = safeText(value.text, 500);
    const emoji = safeText(value.emoji, 16);
    if (!id || (!text && !emoji)) return null;
    return {
        id,
        author: value.author,
        text,
        emoji,
        createdAt: safeText(value.createdAt, 50) || new Date().toISOString()
    };
}

export function sanitizeIdea(value) {
    if (!isPlainObject(value)) return null;
    const id = safeText(value.id, 1000);
    const title = safeText(value.title || value.activity, 300);
    const createdBy = isIdentity(value.createdBy) ? value.createdBy : "Yaoyu";
    if (!id || !title) return null;
    const legacyCategory = safeText(value.category, 80);
    const type = IDEA_TYPES.includes(value.type)
        ? value.type
        : IDEA_TYPES.find((item) => item === legacyCategory) || (legacyCategory.includes("Reise") ? "✈️ Reise" : "💭 Idee");
    const responses = emptyResponses();
    responses.Yaoyu = sanitizeResponse(value.responses?.Yaoyu ?? value.reactions?.Yaoyu);
    responses.Daria = sanitizeResponse(value.responses?.Daria ?? value.reactions?.Daria);
    return {
        kind: "IDEA",
        id,
        createdAt: safeText(value.createdAt, 50) || new Date().toISOString(),
        updatedAt: safeText(value.updatedAt, 50) || safeText(value.createdAt, 50) || new Date().toISOString(),
        createdBy,
        type,
        emoji: TYPE_EMOJI[type] || "💡",
        title,
        description: safeText(value.description || value.note, 1000),
        budget: safeText(value.budget, 160),
        date: isIsoDate(value.date) ? value.date : "",
        startTime: /^\d{2}:\d{2}$/.test(value.startTime || "") ? value.startTime : "",
        endTime: /^\d{2}:\d{2}$/.test(value.endTime || "") ? value.endTime : "",
        responses,
        comments: Array.isArray(value.comments) ? value.comments.map(sanitizeComment).filter(Boolean).slice(-200) : [],
        shareMode: value.shareMode === "response" ? "response" : "item"
    };
}

function ideaFromForm(form, existing = null) {
    const fields = new FormData(form);
    const hasDate = fields.get("dateMode") === "fixed";
    return sanitizeIdea({
        ...(existing || {}),
        id: existing?.id || generateId(),
        kind: "IDEA",
        createdAt: existing?.createdAt || new Date().toISOString(),
        createdBy: existing?.createdBy || getCurrentIdentity(),
        updatedAt: new Date().toISOString(),
        type: fields.get("type"),
        emoji: TYPE_EMOJI[fields.get("type")] || "💡",
        title: fields.get("title"),
        description: fields.get("description"),
        budget: fields.get("budget"),
        date: hasDate ? fields.get("date") : "",
        startTime: "",
        endTime: "",
        responses: existing?.responses || emptyResponses(),
        comments: existing?.comments || []
    });
}

function responseLabel(response) {
    if (!response) return "Noch keine Antwort";
    const option = RESPONSE_OPTIONS.find((item) => item.status === response.status);
    if (!option) return "Noch keine Antwort";
    if (response.status === "OTHER_DATE" && response.suggestedDate) return `${option.short} ${formatDate(response.suggestedDate)}`;
    return option.label;
}

function responseShort(responses) {
    const values = [responses.Yaoyu, responses.Daria];
    if (values.every((item) => item?.status === "ACCEPTED")) return "✓✓";
    if (values.some((item) => item?.status === "DECLINED")) return "×";
    if (values.some((item) => item?.status === "OTHER_DATE")) return "↻";
    if (values.some((item) => item?.status === "MAYBE")) return "?";
    return "";
}

function typeOptions(selected = IDEA_TYPES[0]) {
    return IDEA_TYPES.map((item) => `<option value="${item}" ${item === selected ? "selected" : ""}>${item}</option>`).join("");
}

function ideaFormMarkup(idea = null) {
    const selected = idea || {
        type: IDEA_TYPES[0], title: "", description: "", budget: "", date: ""
    };
    return `
        <form id="idea-form" class="form-stack">
            <div class="form-grid">
                <label class="field"><span>Typ *</span><select name="type" required>${typeOptions(selected.type)}</select></label>
                <label class="field"><span>Titel *</span><input name="title" maxlength="300" value="${escapeAttribute(selected.title)}" required></label>
                <label class="field span-two"><span>Beschreibung</span><textarea name="description" maxlength="1000" rows="4">${escapeHtml(selected.description)}</textarea></label>
                <label class="field span-two"><span>Budget</span><input name="budget" maxlength="160" value="${escapeAttribute(selected.budget)}" placeholder="z. B. ungefähr 100 € pro Person"></label>
                <fieldset class="date-mode-field span-two">
                    <legend>Datum</legend>
                    <label><input type="radio" name="dateMode" value="open" ${selected.date ? "" : "checked"}> Noch kein Datum</label>
                    <label><input type="radio" name="dateMode" value="fixed" ${selected.date ? "checked" : ""}> Datum auswählen und im Kalender anzeigen</label>
                </fieldset>
                <div id="idea-date-fields" class="form-grid span-two" ${selected.date ? "" : "hidden"}>
                    <label class="field"><span>Datum *</span><input name="date" type="date" value="${escapeAttribute(selected.date)}"></label>
                </div>
            </div>
            <p id="idea-form-error" class="error-message" aria-live="polite"></p>
            <div class="action-row"><button class="primary-button" type="submit">${idea ? "Änderungen speichern" : "Idee speichern"}</button></div>
        </form>`;
}

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
}

function escapeAttribute(value = "") {
    return escapeHtml(value);
}

function setupIdeaForm(container, context, existing, onDone) {
    const form = container.querySelector("#idea-form");
    const dateFields = container.querySelector("#idea-date-fields");
    form.querySelectorAll('[name="dateMode"]').forEach((radio) => {
        radio.addEventListener("change", () => {
            dateFields.hidden = form.elements.dateMode.value !== "fixed";
            form.elements.date.required = form.elements.dateMode.value === "fixed";
        });
    });
    form.elements.date.required = form.elements.dateMode.value === "fixed";
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const error = container.querySelector("#idea-form-error");
        error.textContent = "";
        if (!form.reportValidity()) return;
        const idea = ideaFromForm(form, existing);
        if (!idea) {
            error.textContent = "Bitte prüfe Titel und Datum.";
            return;
        }
        updateData((data) => {
            const index = data.wishlistItems.findIndex((item) => item.id === idea.id);
            if (index >= 0) data.wishlistItems[index] = clone(idea);
            else data.wishlistItems.push(clone(idea));
            return data;
        });
        context.toast(existing ? "Idee wurde aktualisiert." : "Idee wurde gespeichert.");
        onDone();
    });
}

function addComment(ideaId, text, emoji) {
    updateData((data) => {
        const raw = data.wishlistItems.find((item) => item.id === ideaId);
        const idea = sanitizeIdea(raw);
        if (!idea) return data;
        idea.comments.push({
            id: generateId(),
            author: getCurrentIdentity(),
            text: safeText(text, 500),
            emoji: safeText(emoji, 16),
            createdAt: new Date().toISOString()
        });
        idea.updatedAt = new Date().toISOString();
        const index = data.wishlistItems.findIndex((item) => item.id === ideaId);
        data.wishlistItems[index] = idea;
        return data;
    });
}

function setResponse(ideaId, status, suggestedDate = "", note = "") {
    updateData((data) => {
        const index = data.wishlistItems.findIndex((item) => item.id === ideaId);
        const idea = sanitizeIdea(data.wishlistItems[index]);
        if (!idea) return data;
        idea.responses[getCurrentIdentity()] = {
            status,
            suggestedDate: status === "OTHER_DATE" && isIsoDate(suggestedDate) ? suggestedDate : "",
            note: safeText(note, 300),
            updatedAt: new Date().toISOString()
        };
        idea.updatedAt = new Date().toISOString();
        data.wishlistItems[index] = idea;
        return data;
    });
}

function appendIdeaCard(parent, idea, context, rerender, editIdea) {
    const card = document.createElement("article");
    card.className = "idea-card";
    const heading = document.createElement("div");
    heading.className = "card-heading";
    const title = document.createElement("h3");
    title.className = "emoji-title";
    title.textContent = idea.title;
    const badge = document.createElement("span");
    badge.className = "badge idea-badge";
    badge.textContent = `${idea.type}${responseShort(idea.responses) ? ` · ${responseShort(idea.responses)}` : ""}`;
    heading.append(title, badge);
    card.append(heading);

    const meta = document.createElement("p");
    meta.className = "meta";
    const dateText = idea.date ? formatDate(idea.date, { weekday: "long" }) : "Datum noch offen";
    meta.textContent = `Von ${idea.createdBy} · ${dateText}`;
    card.append(meta);
    if (idea.description) {
        const description = document.createElement("p");
        description.textContent = idea.description;
        card.append(description);
    }
    if (idea.budget) {
        const budget = document.createElement("p");
        budget.className = "idea-budget";
        budget.textContent = `💶 Budget: ${idea.budget}`;
        card.append(budget);
    }

    const responseOverview = document.createElement("div");
    responseOverview.className = "idea-response-overview";
    ["Yaoyu", "Daria"].forEach((identity) => {
        const row = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = `${identity}: `;
        const text = document.createElement("span");
        text.textContent = responseLabel(idea.responses[identity]);
        row.append(strong, text);
        if (idea.responses[identity]?.note) {
            const note = document.createElement("small");
            note.textContent = idea.responses[identity].note;
            row.append(note);
        }
        responseOverview.append(row);
    });
    card.append(responseOverview);

    const responseArea = document.createElement("div");
    responseArea.className = "idea-response-actions";
    const current = idea.responses[getCurrentIdentity()];
    RESPONSE_OPTIONS.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `reaction-button${current?.status === option.status ? " selected" : ""}`;
        button.textContent = option.label;
        button.addEventListener("click", () => {
            if (option.status === "OTHER_DATE") {
                proposal.hidden = !proposal.hidden;
                if (!proposal.hidden) proposal.querySelector("input")?.focus();
                return;
            }
            setResponse(idea.id, option.status);
            context.toast("Antwort wurde gespeichert.");
            rerender();
        });
        responseArea.append(button);
    });
    const proposal = document.createElement("form");
    proposal.className = "date-proposal-form";
    proposal.hidden = current?.status !== "OTHER_DATE";
    proposal.innerHTML = `
        <label class="field"><span>Anderes Datum *</span><input name="suggestedDate" type="date" value="${escapeAttribute(current?.suggestedDate || "")}" required></label>
        <label class="field"><span>Kurze Erklärung</span><input name="note" maxlength="300" value="${escapeAttribute(current?.note || "")}" placeholder="Wie wäre es am Sonntag?"></label>
        <button class="secondary-button" type="submit">Vorschlag speichern</button>`;
    proposal.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!proposal.reportValidity()) return;
        setResponse(idea.id, "OTHER_DATE", proposal.elements.suggestedDate.value, proposal.elements.note.value);
        context.toast("Datumsvorschlag wurde gespeichert.");
        rerender();
    });
    card.append(responseArea, proposal);

    const comments = document.createElement("section");
    comments.className = "idea-comments";
    const commentsTitle = document.createElement("h4");
    commentsTitle.textContent = `Kommentare (${idea.comments.length})`;
    comments.append(commentsTitle);
    if (idea.comments.length) {
        const list = document.createElement("div");
        list.className = "idea-comment-list";
        idea.comments.forEach((comment) => {
            const item = document.createElement("div");
            item.className = `idea-comment idea-comment-${comment.author.toLowerCase()}`;
            const top = document.createElement("div");
            const author = document.createElement("strong");
            author.textContent = comment.author;
            const time = document.createElement("small");
            const parsed = new Date(comment.createdAt);
            time.textContent = Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
            top.append(author, time);
            const body = document.createElement("p");
            body.textContent = `${comment.emoji ? `${comment.emoji} ` : ""}${comment.text}`.trim();
            item.append(top, body);
            list.append(item);
        });
        comments.append(list);
    }
    const commentForm = document.createElement("form");
    commentForm.className = "idea-comment-form";
    commentForm.innerHTML = `
        <label class="field"><span>Emoji</span><select name="emoji"><option value="">–</option>${["❤️", "👍", "👎", "😊", "🤔", "🥰", "😢", "😂", "✨", "🙏", "🫂", "🔥"].map((emoji) => `<option value="${emoji}">${emoji}</option>`).join("")}</select></label>
        <label class="field idea-comment-text"><span>Kommentar</span><input name="text" maxlength="500" placeholder="Datum, Budget, Ort oder eine kurze Nachricht ..."></label>
        <button class="secondary-button" type="submit">Senden</button>`;
    commentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = safeText(commentForm.elements.text.value, 500);
        const emoji = safeText(commentForm.elements.emoji.value, 16);
        if (!text && !emoji) return;
        addComment(idea.id, text, emoji);
        context.toast("Kommentar wurde hinzugefügt.");
        rerender();
    });
    comments.append(commentForm);
    card.append(comments);

    const actions = document.createElement("div");
    actions.className = "action-row";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary-button";
    edit.textContent = "Bearbeiten";
    edit.addEventListener("click", () => editIdea(idea));
    const share = document.createElement("button");
    share.type = "button";
    share.className = "secondary-button";
    share.textContent = "Teilen";
    share.addEventListener("click", () => context.showShare("wishlist", { ...idea, shareMode: "item" }, "Unsere Idee", idea.title));
    actions.append(edit, share);
    if (idea.date) {
        const openCalendar = document.createElement("button");
        openCalendar.type = "button";
        openCalendar.className = "secondary-button";
        openCalendar.textContent = "Im Kalender öffnen";
        openCalendar.addEventListener("click", () => context.navigate("home", { date: idea.date }));
        actions.append(openCalendar);
        const removeDate = document.createElement("button");
        removeDate.type = "button";
        removeDate.className = "text-button";
        removeDate.textContent = "Datum entfernen";
        removeDate.addEventListener("click", () => {
            updateData((data) => {
                const index = data.wishlistItems.findIndex((item) => item.id === idea.id);
                const currentIdea = sanitizeIdea(data.wishlistItems[index]);
                if (!currentIdea) return data;
                currentIdea.date = "";
                currentIdea.startTime = "";
                currentIdea.endTime = "";
                currentIdea.updatedAt = new Date().toISOString();
                data.wishlistItems[index] = currentIdea;
                return data;
            });
            context.toast("Die Idee bleibt erhalten und wurde aus dem Kalender entfernt.");
            rerender();
        });
        actions.append(removeDate);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger-button";
    remove.textContent = "Idee löschen";
    remove.addEventListener("click", () => {
        if (!window.confirm("Möchtest du diese Idee wirklich für Yaoyu und Daria löschen?")) return;
        updateData((data) => {
            data.wishlistItems = data.wishlistItems.filter((item) => item.id !== idea.id);
            return data;
        });
        context.toast("Idee wurde gelöscht.");
        rerender();
    });
    actions.append(remove);
    card.append(actions);
    parent.append(card);
}

export function renderIdeas(container, context) {
    const rerender = () => renderIdeas(container, context);
    const ideas = (loadData().wishlistItems || []).map(sanitizeIdea).filter(Boolean)
        .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
    container.innerHTML = `
        <header class="page-header page-header-row">
            <div>
                <p class="eyebrow">UNSERE IDEEN</p>
                <h1>Wünsche, Einladungen und gemeinsame Pläne</h1>
                <p class="muted">Sammelt alles an einem Ort. Ein festes Datum zeigt die Idee automatisch im gemeinsamen Kalender.</p>
            </div>
            <button id="toggle-idea-form" class="primary-button" type="button">+ Neue Idee</button>
        </header>
        <section id="idea-form-card" class="module-card" hidden>
            <div class="section-heading"><h2 id="idea-form-title">Neue Idee</h2><button id="close-idea-form" class="icon-button" type="button" aria-label="Formular schließen">×</button></div>
            <div id="idea-form-host"></div>
        </section>
        <section style="margin-top:24px">
            <div class="section-heading"><h2>Alle Ideen</h2><span class="badge">${ideas.length}</span></div>
            <div id="idea-list" class="list-stack"></div>
        </section>`;

    const formCard = container.querySelector("#idea-form-card");
    const formHost = container.querySelector("#idea-form-host");
    const formTitle = container.querySelector("#idea-form-title");
    const openForm = (idea = null) => {
        formTitle.textContent = idea ? "Idee bearbeiten" : "Neue Idee";
        formHost.innerHTML = ideaFormMarkup(idea);
        formCard.hidden = false;
        setupIdeaForm(formHost, context, idea, rerender);
        formHost.querySelector('input[name="title"]')?.focus();
        formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    container.querySelector("#toggle-idea-form").addEventListener("click", () => openForm());
    container.querySelector("#close-idea-form").addEventListener("click", () => { formCard.hidden = true; formHost.replaceChildren(); });

    const list = container.querySelector("#idea-list");
    if (!ideas.length) {
        list.innerHTML = '<div class="module-card empty-state">Noch keine Ideen. Erstellt euren ersten Wunsch, eure erste Einladung oder einen gemeinsamen Plan.</div>';
    } else {
        ideas.forEach((idea) => appendIdeaCard(list, idea, context, rerender, openForm));
    }
}

function mergeSharedIdea(incoming) {
    updateData((data) => {
        const index = data.wishlistItems.findIndex((item) => item.id === incoming.id);
        if (index < 0) data.wishlistItems.push(clone(incoming));
        else {
            const local = sanitizeIdea(data.wishlistItems[index]);
            const merged = clone(incoming);
            merged.comments = [...(local?.comments || []), ...(incoming.comments || [])]
                .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index);
            for (const identity of ["Yaoyu", "Daria"]) {
                if (!merged.responses[identity] && local?.responses[identity]) merged.responses[identity] = local.responses[identity];
            }
            data.wishlistItems[index] = merged;
        }
        return data;
    });
}

export function renderIdeaShare(container, rawPayload, context) {
    const idea = sanitizeIdea(rawPayload);
    if (!idea) {
        context.renderShareError();
        return;
    }
    container.innerHTML = `
        <header class="page-header"><p class="eyebrow">GETEILTE IDEE</p><h1>${escapeHtml(idea.title)}</h1></header>
        <section class="module-card">
            <p class="meta">Von ${escapeHtml(idea.createdBy)} · ${idea.date ? escapeHtml(formatDate(idea.date)) : "Datum noch offen"}</p>
            ${idea.description ? `<p>${escapeHtml(idea.description)}</p>` : ""}
            ${idea.budget ? `<p class="idea-budget">💶 Budget: ${escapeHtml(idea.budget)}</p>` : ""}
            <div class="action-row">
                <button id="save-shared-idea" class="primary-button" type="button">In Unsere Ideen speichern</button>
                <button class="secondary-button" type="button" data-route="home">Abbrechen</button>
            </div>
        </section>`;
    container.querySelector("#save-shared-idea").addEventListener("click", () => {
        mergeSharedIdea(idea);
        context.toast("Geteilte Idee wurde gespeichert.");
        context.clearShare();
    });
}

export { responseShort };
