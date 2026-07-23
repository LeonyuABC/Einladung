import {
    clone,
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
import { PLAN_CATEGORIES } from "./calendar.js";

const WISH_RESPONSES = ["ACCEPTED", "PENDING", "REJECTED", "SUGGEST_OTHER_TIME"];

function sanitizeWishReaction(value) {
    const legacy = {
        HEART: "ACCEPTED",
        NOT_INTERESTED: "REJECTED"
    };
    const normalized = legacy[value] || value;
    return WISH_RESPONSES.includes(normalized) ? normalized : null;
}

function sanitizeSuggestion(value) {
    if (!isPlainObject(value)) return null;
    const suggestedDate = isIsoDate(value.suggestedDate) ? value.suggestedDate : "";
    const suggestedTime = safeText(value.suggestedTime, 80);
    const suggestionText = safeText(value.suggestionText, 300);
    if (!suggestedDate && !suggestedTime && !suggestionText) return null;
    return {
        suggestedDate,
        suggestedTime,
        suggestionText,
        updatedAt: safeText(value.updatedAt, 50) || new Date().toISOString()
    };
}

export function sanitizeSharedWishlist(value) {
    if (!isPlainObject(value) || value.kind !== "WISHLIST") throw new Error("INVALID_WISHLIST");
    const id = safeText(value.id, 1000);
    const activity = safeText(value.activity, 300);
    if (!id || !activity || !isIdentity(value.createdBy)) throw new Error("INVALID_WISHLIST");
    return {
        kind: "WISHLIST",
        id,
        createdAt: safeText(value.createdAt, 50) || new Date().toISOString(),
        createdBy: value.createdBy,
        updatedAt: safeText(value.updatedAt, 50),
        updatedBy: isIdentity(value.updatedBy) ? value.updatedBy : "",
        emoji: safeText(value.emoji, 12, "✨") || "✨",
        category: safeText(value.category, 80, "✨ Sonstiges"),
        activity,
        note: safeText(value.note, 300),
        budget: safeText(value.budget, 80),
        reactions: {
            Yaoyu: sanitizeWishReaction(value.reactions?.Yaoyu),
            Daria: sanitizeWishReaction(value.reactions?.Daria)
        },
        suggestions: {
            Yaoyu: sanitizeSuggestion(value.suggestions?.Yaoyu),
            Daria: sanitizeSuggestion(value.suggestions?.Daria)
        },
        shareMode: value.shareMode === "response" ? "response" : "item"
    };
}

function createWish(form) {
    const fields = new FormData(form);
    return {
        kind: "WISHLIST",
        id: generateId(),
        createdAt: new Date().toISOString(),
        createdBy: getCurrentIdentity(),
        updatedAt: "",
        updatedBy: "",
        emoji: safeText(fields.get("emoji"), 12, "✨") || "✨",
        category: safeText(fields.get("category"), 80),
        activity: safeText(fields.get("activity"), 300),
        note: safeText(fields.get("note"), 300),
        budget: safeText(fields.get("budget"), 80),
        reactions: { Yaoyu: null, Daria: null },
        suggestions: { Yaoyu: null, Daria: null },
        shareMode: "item"
    };
}

function wishCoreSignature(wish) {
    return JSON.stringify([wish.emoji, wish.category, wish.activity, wish.note, wish.budget, wish.createdBy]);
}

function conflictsFor(local, incoming) {
    if (!local) return [];
    const conflicts = [];
    if (wishCoreSignature(local) !== wishCoreSignature(incoming)) conflicts.push("Inhalt");
    for (const identity of ["Yaoyu", "Daria"]) {
        const left = local.reactions[identity];
        const right = incoming.reactions[identity];
        if (left && right && left !== right) conflicts.push(`Antwort von ${identity}`);
        const leftSuggestion = JSON.stringify(local.suggestions[identity]);
        const rightSuggestion = JSON.stringify(incoming.suggestions[identity]);
        if (leftSuggestion !== "null" && rightSuggestion !== "null" && leftSuggestion !== rightSuggestion) {
            conflicts.push(`Zeitvorschlag von ${identity}`);
        }
    }
    return conflicts;
}

function mergeWish(incoming, useShared = false) {
    updateData((data) => {
        const index = data.wishlistItems.findIndex((item) => item.id === incoming.id);
        if (index < 0) {
            data.wishlistItems.push(clone(incoming));
            return data;
        }
        if (useShared) {
            data.wishlistItems[index] = clone(incoming);
            return data;
        }
        const local = sanitizeSharedWishlist({ kind: "WISHLIST", ...data.wishlistItems[index] });
        for (const identity of ["Yaoyu", "Daria"]) {
            if (!local.reactions[identity] && incoming.reactions[identity]) local.reactions[identity] = incoming.reactions[identity];
            if (!local.suggestions[identity] && incoming.suggestions[identity]) local.suggestions[identity] = incoming.suggestions[identity];
        }
        data.wishlistItems[index] = local;
        return data;
    });
}

function setReaction(id, reaction, suggestion = null) {
    updateData((data) => {
        const wish = data.wishlistItems.find((item) => item.id === id);
        if (!wish) return data;
        const identity = getCurrentIdentity();
        wish.reactions ||= { Yaoyu: null, Daria: null };
        wish.suggestions ||= { Yaoyu: null, Daria: null };
        wish.reactions[identity] = sanitizeWishReaction(reaction);
        wish.suggestions[identity] = reaction === "SUGGEST_OTHER_TIME" ? sanitizeSuggestion(suggestion) : null;
        return data;
    });
}

function reactionText(reaction) {
    if (reaction === "ACCEPTED") return "✅ Dabei";
    if (reaction === "PENDING") return "⏳ Vielleicht";
    if (reaction === "REJECTED") return "❌ Eher nicht";
    if (reaction === "SUGGEST_OTHER_TIME") return "🔁 Andere Zeit";
    return "Noch keine Antwort";
}

function suggestionText(suggestion) {
    if (!suggestion) return "";
    const parts = [];
    if (suggestion.suggestedDate) {
        parts.push(new Date(`${suggestion.suggestedDate}T12:00:00`).toLocaleDateString("de-DE"));
    }
    if (suggestion.suggestedTime) parts.push(suggestion.suggestedTime);
    if (suggestion.suggestionText) parts.push(suggestion.suggestionText);
    return parts.join(" · ");
}

function categoryOptions(selected = "") {
    return PLAN_CATEGORIES.map((category) => `<option value="${category}"${category === selected ? " selected" : ""}>${category}</option>`).join("");
}

function appendSuggestionPanel(card, wish, context, rerender) {
    const identity = getCurrentIdentity();
    const current = wish.suggestions[identity];
    const panel = document.createElement("form");
    panel.className = "inline-edit-panel form-stack";
    panel.hidden = true;
    panel.innerHTML = `
        <h4>Anderen Zeitpunkt vorschlagen</h4>
        <div class="form-grid">
            <label class="field"><span>Datum</span><input name="suggestedDate" type="date" min="${localToday()}"></label>
            <label class="field"><span>Zeit</span><input name="suggestedTime" type="text" maxlength="80" placeholder="z. B. Sonntagabend"></label>
            <label class="field span-two"><span>Nachricht</span><textarea name="suggestionText" maxlength="300" placeholder="Wann würde es dir besser passen?"></textarea></label>
        </div>
        <p class="error-message" aria-live="polite"></p>
        <div class="action-row"><button class="primary-button" type="submit">Vorschlag speichern</button><button class="text-button cancel-suggestion" type="button">Abbrechen</button></div>`;
    panel.elements.suggestedDate.value = current?.suggestedDate || "";
    panel.elements.suggestedTime.value = current?.suggestedTime || "";
    panel.elements.suggestionText.value = current?.suggestionText || "";
    panel.addEventListener("submit", (event) => {
        event.preventDefault();
        const fields = new FormData(panel);
        const suggestion = {
            suggestedDate: isIsoDate(fields.get("suggestedDate")) ? fields.get("suggestedDate") : "",
            suggestedTime: safeText(fields.get("suggestedTime"), 80),
            suggestionText: safeText(fields.get("suggestionText"), 300),
            updatedAt: new Date().toISOString()
        };
        if (!suggestion.suggestedDate && !suggestion.suggestedTime && !suggestion.suggestionText) {
            panel.querySelector(".error-message").textContent = "Bitte trage mindestens einen Vorschlag ein.";
            return;
        }
        setReaction(wish.id, "SUGGEST_OTHER_TIME", suggestion);
        context.toast("Dein Zeitvorschlag wird synchronisiert.");
        rerender();
    });
    panel.querySelector(".cancel-suggestion").addEventListener("click", () => { panel.hidden = true; });
    card.append(panel);
    return panel;
}

function appendEditPanel(card, wish, context, rerender) {
    const panel = document.createElement("form");
    panel.className = "inline-edit-panel form-stack";
    panel.hidden = true;
    panel.innerHTML = `
        <div class="section-heading"><h4>Wunsch bearbeiten</h4><button class="icon-button close-wish-edit" type="button" aria-label="Bearbeitung schließen">×</button></div>
        <div class="form-grid">
            <label class="field"><span>Emoji *</span><input name="emoji" type="text" maxlength="12" required></label>
            <label class="field"><span>Kategorie *</span><select name="category" required>${categoryOptions(wish.category)}</select></label>
            <label class="field span-two"><span>Wunsch *</span><input name="activity" type="text" maxlength="300" required></label>
            <label class="field"><span>Budget</span><input name="budget" type="text" maxlength="80" placeholder="z. B. 50 €, pro Person 30 €"></label>
            <label class="field span-two"><span>Notiz</span><textarea name="note" maxlength="300"></textarea></label>
        </div>
        <p class="error-message" aria-live="polite"></p>
        <div class="action-row"><button class="primary-button" type="submit">Änderungen speichern</button></div>`;
    panel.elements.emoji.value = wish.emoji;
    panel.elements.activity.value = wish.activity;
    panel.elements.budget.value = wish.budget;
    panel.elements.note.value = wish.note;
    panel.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!panel.reportValidity()) return;
        const fields = new FormData(panel);
        const activity = safeText(fields.get("activity"), 300);
        if (!activity) {
            panel.querySelector(".error-message").textContent = "Bitte beschreibe euren Wunsch.";
            return;
        }
        updateData((data) => {
            const item = data.wishlistItems.find((entry) => entry.id === wish.id);
            if (!item) return data;
            item.emoji = safeText(fields.get("emoji"), 12, "✨") || "✨";
            item.category = safeText(fields.get("category"), 80, "✨ Sonstiges");
            item.activity = activity;
            item.budget = safeText(fields.get("budget"), 80);
            item.note = safeText(fields.get("note"), 300);
            item.updatedAt = new Date().toISOString();
            item.updatedBy = getCurrentIdentity();
            return data;
        });
        context.toast("Der Wunsch wurde aktualisiert.");
        rerender();
    });
    panel.querySelector(".close-wish-edit").addEventListener("click", () => { panel.hidden = true; });
    card.append(panel);
    return panel;
}

function appendWishCard(parent, wish, context, rerender) {
    const card = document.createElement("article");
    card.className = "list-card";
    const heading = document.createElement("div");
    heading.className = "card-heading";
    const title = document.createElement("h3");
    title.className = "emoji-title";
    const emoji = document.createElement("span");
    emoji.className = "emoji";
    emoji.textContent = wish.emoji;
    const titleText = document.createElement("span");
    titleText.textContent = wish.activity;
    title.append(emoji, titleText);
    const match = wish.reactions.Yaoyu === "ACCEPTED" && wish.reactions.Daria === "ACCEPTED";
    const badge = document.createElement("span");
    badge.className = `badge${match ? " success" : ""}`;
    badge.textContent = match ? "Perfect Match" : wish.category;
    heading.append(title, badge);
    card.append(heading);

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `Von ${wish.createdBy} · Yaoyu: ${reactionText(wish.reactions.Yaoyu)} · Daria: ${reactionText(wish.reactions.Daria)}`;
    card.append(meta);
    if (wish.budget) {
        const budget = document.createElement("p");
        budget.className = "wish-budget";
        budget.textContent = `💶 Budget: ${wish.budget}`;
        card.append(budget);
    }
    if (wish.note) {
        const note = document.createElement("p");
        note.textContent = wish.note;
        card.append(note);
    }
    for (const identity of ["Yaoyu", "Daria"]) {
        if (wish.reactions[identity] !== "SUGGEST_OTHER_TIME" || !wish.suggestions[identity]) continue;
        const suggestion = document.createElement("div");
        suggestion.className = "warning-notice compact-notice";
        suggestion.textContent = `${identity}: ${suggestionText(wish.suggestions[identity])}`;
        card.append(suggestion);
    }

    const reactions = document.createElement("div");
    reactions.className = "reaction-row";
    const currentReaction = wish.reactions[getCurrentIdentity()];
    const options = [
        ["ACCEPTED", "✅ Dabei"],
        ["PENDING", "⏳ Vielleicht"],
        ["REJECTED", "❌ Eher nicht"],
        ["SUGGEST_OTHER_TIME", "🔁 Andere Zeit"]
    ];
    let suggestionPanel;
    options.forEach(([value, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `reaction-button${currentReaction === value ? " selected" : ""}`;
        button.textContent = label;
        button.addEventListener("click", () => {
            if (value === "SUGGEST_OTHER_TIME") {
                suggestionPanel.hidden = !suggestionPanel.hidden;
                if (!suggestionPanel.hidden) suggestionPanel.querySelector("input, textarea")?.focus();
                return;
            }
            setReaction(wish.id, value);
            context.toast("Antwort wird synchronisiert.");
            rerender();
        });
        reactions.append(button);
    });
    card.append(reactions);
    suggestionPanel = appendSuggestionPanel(card, wish, context, rerender);

    const actions = document.createElement("div");
    actions.className = "action-row";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary-button";
    edit.textContent = "Wunsch bearbeiten";
    const editPanel = appendEditPanel(card, wish, context, rerender);
    edit.addEventListener("click", () => {
        editPanel.hidden = !editPanel.hidden;
        if (!editPanel.hidden) editPanel.querySelector("input")?.focus();
    });
    actions.append(edit);

    const share = document.createElement("button");
    share.type = "button";
    share.className = "secondary-button";
    share.textContent = "Wunsch teilen";
    share.addEventListener("click", () => context.showShare("wishlist", { ...wish, shareMode: "item" }, "Wunsch teilen", `${wish.emoji} ${wish.activity}`));
    actions.append(share);
    if (match) {
        const plan = document.createElement("button");
        plan.type = "button";
        plan.className = "primary-button";
        plan.textContent = "Als Plan hinzufügen";
        plan.addEventListener("click", () => context.navigate("calendar", {
            emoji: wish.emoji,
            category: wish.category,
            activity: wish.activity,
            note: [wish.note, wish.budget ? `Budget: ${wish.budget}` : ""].filter(Boolean).join(" · ")
        }));
        const invitation = document.createElement("button");
        invitation.type = "button";
        invitation.className = "secondary-button";
        invitation.textContent = "Einladung erstellen";
        invitation.addEventListener("click", () => context.navigate("invitations", {
            mode: "concrete",
            emoji: wish.emoji,
            category: wish.category,
            activity: wish.activity,
            note: [wish.note, wish.budget ? `Budget: ${wish.budget}` : ""].filter(Boolean).join(" · ")
        }));
        actions.append(plan, invitation);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger-button";
    remove.textContent = "Für beide löschen";
    remove.addEventListener("click", () => {
        if (!window.confirm("Diesen Wunsch für beide Personen auf allen Geräten löschen?")) return;
        updateData((data) => {
            data.wishlistItems = data.wishlistItems.filter((item) => item.id !== wish.id);
            return data;
        });
        context.toast("Wunsch wird auf allen Geräten gelöscht.");
        rerender();
    });
    actions.append(remove);
    card.append(actions);
    parent.append(card);
}

export function renderWishlist(container, context) {
    const rerender = () => renderWishlist(container, context);
    const wishes = loadData().wishlistItems.flatMap((item) => {
        try { return [sanitizeSharedWishlist({ kind: "WISHLIST", ...item })]; } catch (error) { return []; }
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    container.innerHTML = `
        <header class="page-header page-header-row">
            <div><p class="eyebrow">WUNSCHLISTE</p><h1>Was wir erleben möchten</h1><p class="muted">Sammelt Ideen, ergänzt ein Budget und antwortet unabhängig voneinander.</p></div>
            <button id="toggle-wish-form" class="primary-button" type="button">+ Wunsch hinzufügen</button>
        </header>
        <section id="wish-form-card" class="module-card" hidden>
            <div class="section-heading"><h2>Neuer Wunsch</h2><button id="close-wish-form" class="icon-button" type="button" aria-label="Formular schließen">×</button></div>
            <form id="wish-form" class="form-stack">
                <div class="form-grid">
                    <label class="field"><span>Emoji *</span><input name="emoji" type="text" maxlength="12" value="✨" required></label>
                    <label class="field"><span>Kategorie *</span><select name="category" required>${categoryOptions()}</select></label>
                    <label class="field span-two"><span>Was möchtest du machen? *</span><input name="activity" type="text" maxlength="300" required></label>
                    <label class="field"><span>Budget</span><input name="budget" type="text" maxlength="80" placeholder="z. B. 50 €, pro Person 30 €"></label>
                    <label class="field span-two"><span>Notiz</span><textarea name="note" maxlength="300"></textarea></label>
                </div>
                <p id="wish-error" class="error-message" aria-live="polite"></p>
                <div class="action-row"><button class="primary-button" type="submit">Wunsch gemeinsam speichern</button></div>
            </form>
        </section>
        <section style="margin-top:24px">
            <div class="section-heading"><h2>Unsere Wünsche</h2><span class="badge">${wishes.length}</span></div>
            <div id="wish-list" class="list-stack"></div>
        </section>
        <div class="action-row" style="margin-top:20px"><button class="secondary-button" type="button" data-route="home">← Zur Startseite</button></div>`;

    const formCard = container.querySelector("#wish-form-card");
    container.querySelector("#toggle-wish-form").addEventListener("click", () => {
        formCard.hidden = false;
        container.querySelector('#wish-form [name="emoji"]').focus();
    });
    container.querySelector("#close-wish-form").addEventListener("click", () => { formCard.hidden = true; });
    container.querySelector("#wish-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const wish = createWish(form);
        if (!wish.activity) {
            container.querySelector("#wish-error").textContent = "Bitte beschreibe euren Wunsch.";
            return;
        }
        updateData((data) => {
            data.wishlistItems.push(wish);
            return data;
        });
        context.toast("Wunsch wird mit Firebase synchronisiert.");
        rerender();
    });

    const list = container.querySelector("#wish-list");
    if (!wishes.length) {
        list.innerHTML = '<div class="module-card empty-state">Noch keine Wünsche. Sammelt eure erste gemeinsame Idee.</div>';
    } else {
        wishes.forEach((wish) => appendWishCard(list, wish, context, rerender));
    }
}

export function renderWishlistShare(container, rawPayload, context) {
    let wish;
    try {
        wish = sanitizeSharedWishlist(rawPayload);
    } catch (error) {
        context.renderShareError();
        return;
    }
    const identity = getCurrentIdentity();
    const localRaw = loadData().wishlistItems.find((item) => item.id === wish.id);
    const local = localRaw ? sanitizeSharedWishlist({ kind: "WISHLIST", ...localRaw }) : null;
    const conflicts = conflictsFor(local, wish);

    container.innerHTML = `
        <header class="page-header"><p class="eyebrow">GETEILTER WUNSCH</p><h1>Eine Idee für euch</h1><p class="muted">Speichere den Wunsch und ergänze deine Antwort.</p></header>
        <section class="module-card">
            <div class="share-preview"><dl><dt>Geteilt von</dt><dd id="wish-shared-by"></dd><dt>Typ</dt><dd>Wunsch</dd><dt>Inhalt</dt><dd id="wish-shared-content"></dd><dt>Kategorie</dt><dd id="wish-shared-category"></dd><dt>Budget</dt><dd id="wish-shared-budget"></dd></dl></div>
            <p id="wish-shared-note"></p>
            <fieldset style="margin-top:18px"><legend>Meine Antwort als ${identity}</legend><div class="choice-pills">
                <label class="choice-pill"><input type="radio" name="shared-wish-reaction" value="ACCEPTED"><span>✅ Dabei</span></label>
                <label class="choice-pill"><input type="radio" name="shared-wish-reaction" value="PENDING"><span>⏳ Vielleicht</span></label>
                <label class="choice-pill"><input type="radio" name="shared-wish-reaction" value="REJECTED"><span>❌ Eher nicht</span></label>
                <label class="choice-pill"><input type="radio" name="shared-wish-reaction" value="SUGGEST_OTHER_TIME"><span>🔁 Andere Zeit</span></label>
            </div></fieldset>
            <div id="shared-wish-suggestion" class="form-grid suggestion-fields" hidden style="margin-top:14px">
                <label class="field"><span>Datum</span><input name="sharedSuggestedDate" type="date" min="${localToday()}"></label>
                <label class="field"><span>Zeit</span><input name="sharedSuggestedTime" type="text" maxlength="80" placeholder="z. B. Sonntagabend"></label>
                <label class="field span-two"><span>Nachricht</span><textarea name="sharedSuggestionText" maxlength="300"></textarea></label>
            </div>
            <p id="shared-wish-error" class="error-message" aria-live="polite"></p>
            <div id="wish-conflict" class="warning-notice" ${conflicts.length ? "" : "hidden"} style="margin-top:16px"></div>
            <div class="action-row" style="margin-top:18px">
                <button id="save-shared-wish" class="primary-button" type="button">Gemeinsam speichern</button>
                <button id="respond-shared-wish" class="secondary-button" type="button">Antwortlink teilen</button>
                <button class="text-button" type="button" data-route="home">Abbrechen</button>
            </div>
            <div id="wish-conflict-actions" class="action-row" hidden style="margin-top:12px">
                <button id="keep-local-wish" class="secondary-button" type="button">Vorhandene Version behalten</button>
                <button id="use-shared-wish" class="danger-button" type="button">Geteilte Version verwenden</button>
            </div>
        </section>`;
    container.querySelector("#wish-shared-by").textContent = wish.createdBy;
    container.querySelector("#wish-shared-content").textContent = `${wish.emoji} ${wish.activity}`;
    container.querySelector("#wish-shared-category").textContent = wish.category;
    container.querySelector("#wish-shared-budget").textContent = wish.budget || "Nicht eingetragen";
    container.querySelector("#wish-shared-note").textContent = wish.note;
    if (conflicts.length) container.querySelector("#wish-conflict").textContent = `Unterschiede: ${conflicts.join(", ")}. Wähle beim Speichern eine Version.`;
    const suggestionFields = container.querySelector("#shared-wish-suggestion");
    const existingSuggestion = wish.suggestions[identity];
    container.querySelector('[name="sharedSuggestedDate"]').value = existingSuggestion?.suggestedDate || "";
    container.querySelector('[name="sharedSuggestedTime"]').value = existingSuggestion?.suggestedTime || "";
    container.querySelector('[name="sharedSuggestionText"]').value = existingSuggestion?.suggestionText || "";
    container.querySelectorAll('[name="shared-wish-reaction"]').forEach((input) => {
        if (wish.reactions[identity] === input.value) input.checked = true;
        input.addEventListener("change", () => { suggestionFields.hidden = input.value !== "SUGGEST_OTHER_TIME"; });
    });
    suggestionFields.hidden = wish.reactions[identity] !== "SUGGEST_OTHER_TIME";

    function applyReaction() {
        const selected = container.querySelector('[name="shared-wish-reaction"]:checked');
        if (!selected) return true;
        wish.reactions[identity] = selected.value;
        wish.suggestions[identity] = null;
        if (selected.value === "SUGGEST_OTHER_TIME") {
            const suggestion = sanitizeSuggestion({
                suggestedDate: container.querySelector('[name="sharedSuggestedDate"]').value,
                suggestedTime: container.querySelector('[name="sharedSuggestedTime"]').value,
                suggestionText: container.querySelector('[name="sharedSuggestionText"]').value,
                updatedAt: new Date().toISOString()
            });
            if (!suggestion) {
                container.querySelector("#shared-wish-error").textContent = "Bitte trage mindestens einen Zeitvorschlag ein.";
                return false;
            }
            wish.suggestions[identity] = suggestion;
        }
        return true;
    }
    function save(useShared = false) {
        if (!applyReaction()) return;
        mergeWish(wish, useShared);
        context.toast("Wunsch wird synchronisiert.");
        context.clearShare();
    }
    container.querySelector("#save-shared-wish").addEventListener("click", () => {
        if (conflicts.length) {
            container.querySelector("#wish-conflict-actions").hidden = false;
            return;
        }
        save(false);
    });
    container.querySelector("#keep-local-wish").addEventListener("click", () => save(false));
    container.querySelector("#use-shared-wish").addEventListener("click", () => save(true));
    container.querySelector("#respond-shared-wish").addEventListener("click", () => {
        if (!applyReaction()) return;
        wish.shareMode = "response";
        mergeWish(wish, false);
        context.showShare("wishlist", wish, "Antwort auf einen Wunsch", `${identity} hat auf ${wish.emoji} ${wish.activity} geantwortet.`);
    });
}
