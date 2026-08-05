import {
    clone,
    generateId,
    getCurrentIdentity,
    isIdentity,
    loadData,
    safeText,
    updateData
} from "./storage.js";
import { isPlainObject } from "./share.js";
import { PLAN_CATEGORIES } from "./calendar.js";

function sanitizeWishReaction(value) {
    return ["HEART", "NOT_INTERESTED"].includes(value) ? value : null;
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
        emoji: safeText(value.emoji, 12, "✨") || "✨",
        category: safeText(value.category, 80, "✨ Sonstiges"),
        activity,
        note: safeText(value.note, 300),
        reactions: {
            Yaoyu: sanitizeWishReaction(value.reactions?.Yaoyu),
            Daria: sanitizeWishReaction(value.reactions?.Daria)
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
        emoji: safeText(fields.get("emoji"), 12, "✨") || "✨",
        category: safeText(fields.get("category"), 80),
        activity: safeText(fields.get("activity"), 300),
        note: safeText(fields.get("note"), 300),
        reactions: { Yaoyu: null, Daria: null },
        shareMode: "item"
    };
}

function wishCoreSignature(wish) {
    return JSON.stringify([wish.emoji, wish.category, wish.activity, wish.note, wish.createdBy]);
}

function conflictsFor(local, incoming) {
    if (!local) return [];
    const conflicts = [];
    if (wishCoreSignature(local) !== wishCoreSignature(incoming)) conflicts.push("Inhalt");
    for (const identity of ["Yaoyu", "Daria"]) {
        const left = local.reactions[identity];
        const right = incoming.reactions[identity];
        if (left && right && left !== right) conflicts.push(`Reaktion von ${identity}`);
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
        }
        data.wishlistItems[index] = local;
        return data;
    });
}

function setReaction(id, reaction) {
    updateData((data) => {
        const wish = data.wishlistItems.find((item) => item.id === id);
        if (!wish) return data;
        wish.reactions ||= { Yaoyu: null, Daria: null };
        wish.reactions[getCurrentIdentity()] = reaction;
        return data;
    });
}

function reactionText(reaction) {
    if (reaction === "HEART") return "❤️ Möchte ich auch";
    if (reaction === "NOT_INTERESTED") return "🥀 Eher nicht";
    return "Noch keine Reaktion";
}

function categoryOptions() {
    return PLAN_CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("");
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
    const match = wish.reactions.Yaoyu === "HEART" && wish.reactions.Daria === "HEART";
    const badge = document.createElement("span");
    badge.className = `badge${match ? " success" : ""}`;
    badge.textContent = match ? "Perfect Match" : wish.category;
    heading.append(title, badge);
    card.append(heading);

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `Von ${wish.createdBy} · Yaoyu: ${reactionText(wish.reactions.Yaoyu)} · Daria: ${reactionText(wish.reactions.Daria)}`;
    card.append(meta);
    if (wish.note) {
        const note = document.createElement("p");
        note.textContent = wish.note;
        card.append(note);
    }

    const reactions = document.createElement("div");
    reactions.className = "reaction-row";
    [["HEART", "❤️ Möchte ich auch"], ["NOT_INTERESTED", "🥀 Eher nicht"]].forEach(([value, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `reaction-button${wish.reactions[getCurrentIdentity()] === value ? " selected" : ""}`;
        button.textContent = label;
        button.addEventListener("click", () => {
            setReaction(wish.id, value);
            context.toast("Reaktion wird synchronisiert.");
            rerender();
        });
        reactions.append(button);
    });
    card.append(reactions);

    const actions = document.createElement("div");
    actions.className = "action-row";
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
            note: wish.note
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
            note: wish.note
        }));
        actions.append(plan, invitation);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger-button";
    remove.textContent = "Lokal löschen";
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
            <div><p class="eyebrow">WUNSCHLISTE</p><h1>Was wir erleben möchten</h1><p class="muted">Sammelt Ideen und findet eure Perfect Matches.</p></div>
            <button id="toggle-wish-form" class="primary-button" type="button">+ Wunsch hinzufügen</button>
        </header>
        <section id="wish-form-card" class="module-card" hidden>
            <div class="section-heading"><h2>Neuer Wunsch</h2><button id="close-wish-form" class="icon-button" type="button" aria-label="Formular schließen">×</button></div>
            <form id="wish-form" class="form-stack">
                <div class="form-grid">
                    <label class="field"><span>Emoji *</span><input name="emoji" type="text" maxlength="12" value="✨" required></label>
                    <label class="field"><span>Kategorie *</span><select name="category" required>${categoryOptions()}</select></label>
                    <label class="field span-two"><span>Was möchtest du machen? *</span><input name="activity" type="text" maxlength="300" required></label>
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
        <header class="page-header"><p class="eyebrow">GETEILTER WUNSCH</p><h1>Eine Idee für euch</h1><p class="muted">Speichere den Wunsch und schicke deine Reaktion zurück.</p></header>
        <section class="module-card">
            <div class="share-preview"><dl><dt>Geteilt von</dt><dd id="wish-shared-by"></dd><dt>Typ</dt><dd>Wunsch</dd><dt>Inhalt</dt><dd id="wish-shared-content"></dd><dt>Kategorie</dt><dd id="wish-shared-category"></dd></dl></div>
            <p id="wish-shared-note"></p>
            <fieldset style="margin-top:18px"><legend>Meine Reaktion als ${identity}</legend><div class="choice-pills">
                <label class="choice-pill"><input type="radio" name="shared-wish-reaction" value="HEART"><span>❤️ Möchte ich auch</span></label>
                <label class="choice-pill"><input type="radio" name="shared-wish-reaction" value="NOT_INTERESTED"><span>🥀 Eher nicht</span></label>
            </div></fieldset>
            <div id="wish-conflict" class="warning-notice" ${conflicts.length ? "" : "hidden"} style="margin-top:16px"></div>
            <div class="action-row" style="margin-top:18px">
                <button id="save-shared-wish" class="primary-button" type="button">Lokal speichern</button>
                <button id="respond-shared-wish" class="secondary-button" type="button">Reaktionslink teilen</button>
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
    container.querySelector("#wish-shared-note").textContent = wish.note;
    if (conflicts.length) container.querySelector("#wish-conflict").textContent = `Unterschiede: ${conflicts.join(", ")}. Wähle beim Speichern eine Version.`;
    container.querySelectorAll('[name="shared-wish-reaction"]').forEach((input) => {
        if (wish.reactions[identity] === input.value) input.checked = true;
    });
    function applyReaction() {
        const selected = container.querySelector('[name="shared-wish-reaction"]:checked');
        if (selected) wish.reactions[identity] = selected.value;
    }
    function save(useShared = false) {
        applyReaction();
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
        applyReaction();
        wish.shareMode = "response";
        mergeWish(wish, false);
        context.showShare("wishlist", wish, "Reaktion auf einen Wunsch", `${identity} hat auf ${wish.emoji} ${wish.activity} reagiert.`);
    });
}
