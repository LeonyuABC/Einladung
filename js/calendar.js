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
import { buildShareUrl, isPlainObject } from "./share.js";

export const PLAN_CATEGORIES = [
    "📚 Lernen",
    "🎬 Freizeit",
    "🍕 Essen",
    "🚆 Kleiner Ausflug",
    "✈️ Große Reise",
    "🏠 Zuhause",
    "✨ Sonstiges"
];

const TIME_OPTIONS = ["", "Vormittags", "Nachmittags", "Abends", "Ganzer Tag", "Egal"];
let visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDate = localToday();

function optionMarkup(options) {
    return options.map((item) => `<option value="${item}">${item || "Keine Auswahl"}</option>`).join("");
}

function emptyReactions() {
    return { Yaoyu: null, Daria: null };
}

function sanitizeReaction(value) {
    if (!isPlainObject(value) || !["HEART", "NO_TIME", "OTHER_DATE"].includes(value.type)) return null;
    return {
        type: value.type,
        suggestedDate: value.type === "OTHER_DATE" && isIsoDate(value.suggestedDate) ? value.suggestedDate : ""
    };
}

export function sanitizeSharedPlan(value) {
    if (!isPlainObject(value) || value.kind !== "PLAN") throw new Error("INVALID_PLAN");
    const id = safeText(value.id, 1000);
    const activity = safeText(value.activity, 300);
    if (!id || !activity || !isIsoDate(value.date) || !isIdentity(value.createdBy)) throw new Error("INVALID_PLAN");
    return {
        kind: "PLAN",
        id,
        createdAt: safeText(value.createdAt, 50) || new Date().toISOString(),
        createdBy: value.createdBy,
        date: value.date,
        emoji: safeText(value.emoji, 12, "📅") || "📅",
        category: safeText(value.category, 80, "✨ Sonstiges"),
        activity,
        time: safeText(value.time, 50),
        note: safeText(value.note, 300),
        reactions: {
            Yaoyu: sanitizeReaction(value.reactions?.Yaoyu),
            Daria: sanitizeReaction(value.reactions?.Daria)
        },
        shareMode: value.shareMode === "response" ? "response" : "item"
    };
}

function createPlan(form) {
    const fields = new FormData(form);
    return {
        kind: "PLAN",
        id: generateId(),
        createdAt: new Date().toISOString(),
        createdBy: getCurrentIdentity(),
        date: fields.get("date"),
        emoji: safeText(fields.get("emoji"), 12, "📅") || "📅",
        category: safeText(fields.get("category"), 80),
        activity: safeText(fields.get("activity"), 300),
        time: safeText(fields.get("time"), 50),
        note: safeText(fields.get("note"), 300),
        reactions: emptyReactions(),
        shareMode: "item"
    };
}

function coreSignature(plan) {
    return JSON.stringify([plan.date, plan.emoji, plan.category, plan.activity, plan.time, plan.note, plan.createdBy]);
}

function findPlanConflicts(local, incoming) {
    if (!local) return [];
    const conflicts = [];
    if (coreSignature(local) !== coreSignature(incoming)) conflicts.push("Inhalt");
    for (const identity of ["Yaoyu", "Daria"]) {
        const left = local.reactions?.[identity] || null;
        const right = incoming.reactions?.[identity] || null;
        if (left && right && JSON.stringify(left) !== JSON.stringify(right)) conflicts.push(`Reaktion von ${identity}`);
    }
    return conflicts;
}

function mergePlan(incoming, useShared) {
    updateData((data) => {
        const index = data.plans.findIndex((item) => item.id === incoming.id);
        if (index < 0) {
            data.plans.push(clone(incoming));
            return data;
        }
        const local = sanitizeSharedPlan({ kind: "PLAN", ...data.plans[index] });
        if (useShared) {
            data.plans[index] = clone(incoming);
            return data;
        }
        for (const identity of ["Yaoyu", "Daria"]) {
            if (!local.reactions[identity] && incoming.reactions[identity]) {
                local.reactions[identity] = clone(incoming.reactions[identity]);
            }
        }
        data.plans[index] = local;
        return data;
    });
}

function setPlanReaction(planId, type, suggestedDate = "") {
    const identity = getCurrentIdentity();
    updateData((data) => {
        const plan = data.plans.find((item) => item.id === planId);
        if (!plan) return data;
        plan.reactions ||= emptyReactions();
        plan.reactions[identity] = { type, suggestedDate: type === "OTHER_DATE" ? suggestedDate : "" };
        return data;
    });
}

function reactionText(reaction) {
    if (!reaction) return "Noch keine Reaktion";
    if (reaction.type === "HEART") return "❤️ Passt mir";
    if (reaction.type === "NO_TIME") return "🥀 Keine Zeit";
    return `🔁 ${formatDate(reaction.suggestedDate)}`;
}

function appendPlanCard(parent, rawPlan, context, rerender, compact = false) {
    let plan;
    try {
        plan = sanitizeSharedPlan({ kind: "PLAN", ...rawPlan });
    } catch (error) {
        return;
    }
    const card = document.createElement("article");
    card.className = "list-card";

    const heading = document.createElement("div");
    heading.className = "card-heading";
    const title = document.createElement("h3");
    title.className = "emoji-title";
    const emoji = document.createElement("span");
    emoji.className = "emoji";
    emoji.textContent = plan.emoji;
    const titleText = document.createElement("span");
    titleText.textContent = plan.activity;
    title.append(emoji, titleText);
    const badge = document.createElement("span");
    const confirmed = plan.reactions.Yaoyu?.type === "HEART" && plan.reactions.Daria?.type === "HEART";
    badge.className = `badge${confirmed ? " success" : ""}`;
    badge.textContent = confirmed ? "Von euch beiden bestätigt" : plan.category;
    heading.append(title, badge);
    card.append(heading);

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `${formatDate(plan.date, { weekday: "long" })}${plan.time ? ` · ${plan.time}` : ""} · von ${plan.createdBy}`;
    card.append(meta);

    if (plan.note && !compact) {
        const note = document.createElement("p");
        note.textContent = plan.note;
        card.append(note);
    }

    if (!compact) {
        const reactionSummary = document.createElement("p");
        reactionSummary.className = "meta";
        reactionSummary.textContent = `Yaoyu: ${reactionText(plan.reactions.Yaoyu)} · Daria: ${reactionText(plan.reactions.Daria)}`;
        card.append(reactionSummary);

        const reactions = document.createElement("div");
        reactions.className = "reaction-row";
        const currentReaction = plan.reactions[getCurrentIdentity()];
        [
            ["HEART", "❤️ Passt mir"],
            ["NO_TIME", "🥀 Keine Zeit"],
            ["OTHER_DATE", "🔁 Anderer Tag"]
        ].forEach(([type, label]) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `reaction-button${currentReaction?.type === type ? " selected" : ""}`;
            button.textContent = label;
            button.addEventListener("click", () => {
                if (type === "OTHER_DATE") {
                    alternative.hidden = false;
                    alternative.focus();
                    return;
                }
                setPlanReaction(plan.id, type);
                context.toast("Reaktion wurde lokal gespeichert.");
                rerender();
            });
            reactions.append(button);
        });
        const alternative = document.createElement("input");
        alternative.type = "date";
        alternative.className = "secondary-button";
        alternative.min = localToday();
        alternative.hidden = currentReaction?.type !== "OTHER_DATE";
        alternative.value = currentReaction?.suggestedDate || "";
        alternative.setAttribute("aria-label", "Anderes Datum vorschlagen");
        alternative.addEventListener("change", () => {
            if (!isIsoDate(alternative.value)) return;
            setPlanReaction(plan.id, "OTHER_DATE", alternative.value);
            context.toast("Datumsvorschlag wurde gespeichert.");
            rerender();
        });
        reactions.append(alternative);
        card.append(reactions);

        const actions = document.createElement("div");
        actions.className = "action-row";
        const share = document.createElement("button");
        share.type = "button";
        share.className = "secondary-button";
        share.textContent = "Plan teilen";
        share.addEventListener("click", () => context.showShare("plan", { ...plan, shareMode: "item" }, "Plan teilen", `${plan.emoji} ${plan.activity}`));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "danger-button";
        remove.textContent = "Lokal löschen";
        remove.addEventListener("click", () => {
            if (!window.confirm("Diesen Plan nur in diesem Browser löschen?")) return;
            updateData((data) => {
                data.plans = data.plans.filter((item) => item.id !== plan.id);
                return data;
            });
            context.toast("Plan wurde lokal gelöscht.");
            rerender();
        });
        actions.append(share, remove);
        card.append(actions);
    }
    parent.append(card);
}

function renderCalendarGrid(container, plans, context, rerender) {
    const monthTitle = container.querySelector("#calendar-month-title");
    monthTitle.textContent = visibleMonth.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const grid = container.querySelector("#calendar-grid");
    grid.replaceChildren();
    ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].forEach((day) => {
        const label = document.createElement("div");
        label.className = "calendar-weekday";
        label.textContent = day;
        grid.append(label);
    });

    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const leadingDays = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let index = 0; index < leadingDays; index += 1) {
        const blank = document.createElement("span");
        blank.className = "calendar-day empty";
        grid.append(blank);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayPlans = plans.filter((plan) => plan.date === iso);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `calendar-day${iso === localToday() ? " today" : ""}${iso === selectedDate ? " selected" : ""}`;
        button.setAttribute("aria-label", `${formatDate(iso)}, ${dayPlans.length} Pläne`);
        const number = document.createElement("span");
        number.textContent = String(day);
        const emojis = document.createElement("span");
        emojis.className = "day-emojis";
        emojis.textContent = dayPlans.slice(0, 2).map((plan) => safeText(plan.emoji, 12, "📅")).join(" ");
        const count = document.createElement("span");
        count.className = "day-count";
        count.textContent = dayPlans.length ? `${dayPlans.length} Plan${dayPlans.length === 1 ? "" : "e"}` : "";
        button.append(number, emojis, count);
        button.addEventListener("click", () => {
            selectedDate = iso;
            rerender();
        });
        grid.append(button);
    }

    const dayPanel = container.querySelector("#selected-day-plans");
    dayPanel.replaceChildren();
    const selectedPlans = plans.filter((plan) => plan.date === selectedDate);
    const heading = document.createElement("h2");
    heading.textContent = formatDate(selectedDate, { weekday: "long" });
    dayPanel.append(heading);
    if (!selectedPlans.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Für diesen Tag gibt es noch keinen Plan.";
        dayPanel.append(empty);
    } else {
        selectedPlans.forEach((plan) => appendPlanCard(dayPanel, plan, context, rerender, true));
    }
}

export function renderCalendar(container, context) {
    const prefill = context.consumePrefill?.("calendar") || {};
    const rerender = () => renderCalendar(container, context);
    const data = loadData();
    const plans = data.plans.flatMap((item) => {
        try { return [sanitizeSharedPlan({ kind: "PLAN", ...item })]; } catch (error) { return []; }
    });

    container.innerHTML = `
        <header class="page-header page-header-row">
            <div><p class="eyebrow">PLANUNGSZENTRUM</p><h1>Unsere Pläne</h1><p class="muted">Kalender, Ideen und Reaktionen – lokal auf diesem Gerät.</p></div>
            <button id="toggle-plan-form" class="primary-button" type="button">+ Plan hinzufügen</button>
        </header>
        <section id="plan-form-card" class="module-card" ${Object.keys(prefill).length ? "" : "hidden"}>
            <div class="section-heading"><h2>Neuer Plan</h2><button id="close-plan-form" class="icon-button" type="button" aria-label="Formular schließen">×</button></div>
            <form id="plan-form" class="form-stack">
                <div class="form-grid">
                    <label class="field"><span>Datum *</span><input name="date" type="date" required></label>
                    <label class="field"><span>Emoji *</span><input name="emoji" type="text" maxlength="12" value="📅" required></label>
                    <label class="field"><span>Kategorie *</span><select name="category" required>${optionMarkup(PLAN_CATEGORIES)}</select></label>
                    <label class="field"><span>Zeit</span><select name="time">${optionMarkup(TIME_OPTIONS)}</select></label>
                    <label class="field span-two"><span>Was möchtet ihr machen? *</span><input name="activity" type="text" maxlength="300" required></label>
                    <label class="field span-two"><span>Notiz</span><textarea name="note" maxlength="300"></textarea></label>
                </div>
                <p id="plan-error" class="error-message" aria-live="polite"></p>
                <div class="action-row"><button class="primary-button" type="submit">Plan lokal speichern</button></div>
            </form>
        </section>
        <section class="calendar-layout" style="margin-top:20px">
            <article class="calendar-card">
                <div class="calendar-controls">
                    <button id="previous-month" class="icon-button" type="button" aria-label="Vorheriger Monat">←</button>
                    <h2 id="calendar-month-title"></h2>
                    <button id="next-month" class="icon-button" type="button" aria-label="Nächster Monat">→</button>
                </div>
                <div id="calendar-grid" class="calendar-grid"></div>
            </article>
            <aside id="selected-day-plans" class="module-card day-panel"></aside>
        </section>
        <section style="margin-top:28px">
            <div class="section-heading"><h2>Alle Pläne</h2><span class="badge">${plans.length}</span></div>
            <div id="all-plans" class="list-stack"></div>
        </section>
        <div class="action-row" style="margin-top:20px"><button class="secondary-button" type="button" data-route="home">← Zur Startseite</button></div>`;

    const formCard = container.querySelector("#plan-form-card");
    const form = container.querySelector("#plan-form");
    const dateInput = form.elements.date;
    dateInput.value = isIsoDate(prefill.date) ? prefill.date : selectedDate;
    dateInput.min = "2000-01-01";
    form.elements.emoji.value = safeText(prefill.emoji, 12, "📅") || "📅";
    if (PLAN_CATEGORIES.includes(prefill.category)) form.elements.category.value = prefill.category;
    form.elements.activity.value = safeText(prefill.activity, 300);
    form.elements.note.value = safeText(prefill.note, 300);

    container.querySelector("#toggle-plan-form").addEventListener("click", () => {
        formCard.hidden = false;
        dateInput.focus();
    });
    container.querySelector("#close-plan-form").addEventListener("click", () => { formCard.hidden = true; });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const error = container.querySelector("#plan-error");
        if (!form.reportValidity()) return;
        const plan = createPlan(form);
        if (!isIsoDate(plan.date) || !plan.activity) {
            error.textContent = "Bitte prüfe Datum und Aktivität.";
            return;
        }
        updateData((current) => {
            current.plans.push(plan);
            return current;
        });
        selectedDate = plan.date;
        context.toast("Plan wurde lokal gespeichert.");
        rerender();
    });

    container.querySelector("#previous-month").addEventListener("click", () => {
        visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
        rerender();
    });
    container.querySelector("#next-month").addEventListener("click", () => {
        visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
        rerender();
    });

    renderCalendarGrid(container, plans, context, rerender);
    const list = container.querySelector("#all-plans");
    if (!plans.length) {
        list.innerHTML = '<div class="module-card empty-state">Noch keine Pläne. Fügt euren ersten gemeinsamen Termin hinzu.</div>';
    } else {
        plans.sort((a, b) => a.date.localeCompare(b.date)).forEach((plan) => appendPlanCard(list, plan, context, rerender));
    }
}

export function renderPlanShare(container, rawPayload, context) {
    let plan;
    try {
        plan = sanitizeSharedPlan(rawPayload);
    } catch (error) {
        context.renderShareError();
        return;
    }
    const identity = getCurrentIdentity();
    const local = loadData().plans.find((item) => item.id === plan.id);
    const conflicts = findPlanConflicts(local ? sanitizeSharedPlan({ kind: "PLAN", ...local }) : null, plan);

    container.innerHTML = `
        <header class="page-header"><p class="eyebrow">GETEILTER PLAN</p><h1>Ein Plan für euch</h1><p class="muted">Prüfe den Inhalt, bevor du ihn lokal speicherst.</p></header>
        <section class="module-card">
            <div class="share-preview"><dl><dt>Geteilt von</dt><dd id="shared-by"></dd><dt>Typ</dt><dd>Plan</dd><dt>Inhalt</dt><dd id="shared-content"></dd><dt>Datum</dt><dd id="shared-date"></dd></dl></div>
            <p id="shared-note"></p>
            <fieldset style="margin-top:18px"><legend>Meine Reaktion als ${identity}</legend>
                <div class="choice-pills">
                    <label class="choice-pill"><input type="radio" name="shared-plan-reaction" value="HEART"><span>❤️ Passt mir</span></label>
                    <label class="choice-pill"><input type="radio" name="shared-plan-reaction" value="NO_TIME"><span>🥀 Keine Zeit</span></label>
                    <label class="choice-pill"><input type="radio" name="shared-plan-reaction" value="OTHER_DATE"><span>🔁 Anderer Tag</span></label>
                </div>
            </fieldset>
            <label id="shared-date-field" class="field" hidden style="margin-top:12px"><span>Vorgeschlagenes Datum</span><input id="shared-suggested-date" type="date" min="${localToday()}"></label>
            <div id="plan-conflict" class="warning-notice" ${conflicts.length ? "" : "hidden"} style="margin-top:16px"></div>
            <p id="plan-share-error" class="error-message" aria-live="polite"></p>
            <div class="action-row" style="margin-top:18px">
                <button id="save-shared-plan" class="primary-button" type="button">Lokal speichern</button>
                <button id="respond-shared-plan" class="secondary-button" type="button">Reaktionslink teilen</button>
                <button class="text-button" type="button" data-route="home">Abbrechen</button>
            </div>
            <div id="plan-conflict-actions" class="action-row" hidden style="margin-top:12px">
                <button id="keep-local-plan" class="secondary-button" type="button">Lokale Version behalten</button>
                <button id="use-shared-plan" class="danger-button" type="button">Geteilte Version verwenden</button>
            </div>
        </section>`;

    container.querySelector("#shared-by").textContent = plan.createdBy;
    container.querySelector("#shared-content").textContent = `${plan.emoji} ${plan.activity}`;
    container.querySelector("#shared-date").textContent = `${formatDate(plan.date, { weekday: "long" })}${plan.time ? ` · ${plan.time}` : ""}`;
    container.querySelector("#shared-note").textContent = plan.note;
    const conflictBox = container.querySelector("#plan-conflict");
    if (conflicts.length) conflictBox.textContent = `Es gibt lokale Unterschiede bei: ${conflicts.join(", ")}. Wähle beim Speichern eine Version.`;

    const dateField = container.querySelector("#shared-date-field");
    container.querySelectorAll('[name="shared-plan-reaction"]').forEach((input) => {
        if (plan.reactions[identity]?.type === input.value) input.checked = true;
        input.addEventListener("change", () => { dateField.hidden = input.value !== "OTHER_DATE"; });
    });
    if (plan.reactions[identity]?.type === "OTHER_DATE") {
        dateField.hidden = false;
        container.querySelector("#shared-suggested-date").value = plan.reactions[identity].suggestedDate;
    }

    function applyReaction() {
        const selected = container.querySelector('[name="shared-plan-reaction"]:checked');
        if (!selected) return true;
        const suggestedDate = container.querySelector("#shared-suggested-date").value;
        if (selected.value === "OTHER_DATE" && !isIsoDate(suggestedDate)) {
            container.querySelector("#plan-share-error").textContent = "Bitte wähle ein gültiges vorgeschlagenes Datum.";
            return false;
        }
        plan.reactions[identity] = { type: selected.value, suggestedDate: selected.value === "OTHER_DATE" ? suggestedDate : "" };
        return true;
    }

    function save(useShared = false) {
        if (!applyReaction()) return;
        mergePlan(plan, useShared);
        context.toast("Plan wurde lokal gespeichert.");
        context.clearShare();
    }

    container.querySelector("#save-shared-plan").addEventListener("click", () => {
        if (conflicts.length) {
            container.querySelector("#plan-conflict-actions").hidden = false;
            return;
        }
        save(false);
    });
    container.querySelector("#keep-local-plan").addEventListener("click", () => save(false));
    container.querySelector("#use-shared-plan").addEventListener("click", () => save(true));
    container.querySelector("#respond-shared-plan").addEventListener("click", () => {
        if (!applyReaction()) return;
        plan.shareMode = "response";
        mergePlan(plan, false);
        context.showShare("plan", plan, "Reaktion auf einen Plan", `${identity} hat auf ${plan.emoji} ${plan.activity} reagiert.`);
    });
}
