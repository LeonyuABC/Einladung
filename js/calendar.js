import {
    formatDate,
    generateId,
    getCurrentIdentity,
    isIsoDate,
    loadData,
    localToday,
    safeText,
    updateData
} from "./storage.js";
import { sanitizeIdea, responseShort } from "./ideas.js";
import { moodForDate, renderMoodEditor } from "./mood.js";
import { LOVE_QUOTES, quoteForIdentity } from "./quotes.js";

export const PLAN_CATEGORIES = [
    "📚 Lernen",
    "🎬 Freizeit",
    "🍕 Essen",
    "🚆 Kleiner Ausflug",
    "✈️ Große Reise",
    "🏠 Zuhause",
    "✨ Sonstiges"
];

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const RELATIONSHIP_START = "2026-07-19";
let visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDate = localToday();
let quoteTimer = null;

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
}

function dateFromIso(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function isoFromParts(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatSelectedDate(value) {
    return dateFromIso(value).toLocaleDateString("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function relationshipDays(today = localToday()) {
    const start = dateFromIso(RELATIONSHIP_START);
    const current = dateFromIso(today);
    const difference = Math.floor((current - start) / 86400000);
    return Math.max(1, difference + 1);
}

function seededShuffle(items, seedText) {
    let seed = 2166136261;
    for (const character of seedText) {
        seed ^= character.charCodeAt(0);
        seed = Math.imul(seed, 16777619);
    }
    const result = [...items];
    const random = () => {
        seed += 0x6D2B79F5;
        let value = seed;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    for (let index = result.length - 1; index > 0; index -= 1) {
        const target = Math.floor(random() * (index + 1));
        [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
}

function renderQuoteCard(container) {
    window.clearInterval(quoteTimer);
    const identity = getCurrentIdentity();
    const today = localToday();
    const shuffled = seededShuffle(LOVE_QUOTES, `${today}-${identity}`);
    // Pick a fresh position whenever the quote card is opened/rendered so the
    // full collection is reachable instead of always starting at today's slot.
    let index = Math.floor(Math.random() * shuffled.length);
    const card = container.querySelector("#love-quote-card");
    const zh = card.querySelector("#quote-zh");
    const uk = card.querySelector("#quote-uk");
    const sourceZh = card.querySelector("#quote-source-zh");
    const sourceUk = card.querySelector("#quote-source-uk");
    const counter = card.querySelector("#quote-counter");

    const show = (nextIndex, animate = true) => {
        index = (nextIndex + shuffled.length) % shuffled.length;
        const quote = quoteForIdentity(shuffled[index], identity);
        if (animate) card.classList.remove("quote-changed");
        zh.textContent = quote.zh;
        uk.textContent = quote.uk;
        sourceZh.textContent = quote.sourceZh;
        sourceUk.textContent = quote.sourceUk;
        counter.textContent = `${index + 1} / ${shuffled.length}`;
        if (animate) requestAnimationFrame(() => card.classList.add("quote-changed"));
    };
    const restart = () => {
        window.clearInterval(quoteTimer);
        quoteTimer = window.setInterval(() => show(index + 1), 5000);
    };
    card.querySelector("#quote-previous").addEventListener("click", () => { show(index - 1); restart(); });
    card.querySelector("#quote-next").addEventListener("click", () => { show(index + 1); restart(); });
    show(index, false);
    restart();
}

function sanitizeReactionMap(value) {
    if (!value || typeof value !== "object") return { Yaoyu: null, Daria: null };
    return { Yaoyu: value.Yaoyu ?? null, Daria: value.Daria ?? null };
}

export function sanitizePlan(value) {
    if (!value || typeof value !== "object") return null;
    const id = safeText(value.id, 1000);
    const date = safeText(value.date, 10);
    const title = safeText(value.title || value.activity, 300);
    if (!id || !isIsoDate(date) || !title) return null;
    return {
        kind: "PLAN",
        id,
        createdAt: safeText(value.createdAt, 50) || new Date().toISOString(),
        updatedAt: safeText(value.updatedAt, 50) || safeText(value.createdAt, 50) || new Date().toISOString(),
        createdBy: ["Yaoyu", "Daria"].includes(value.createdBy) ? value.createdBy : "Yaoyu",
        emoji: safeText(value.emoji, 16, "📅") || "📅",
        category: safeText(value.category, 80, "✨ Sonstiges"),
        title,
        activity: title,
        description: safeText(value.description || value.note, 1000),
        note: safeText(value.description || value.note, 1000),
        date,
        startTime: /^\d{2}:\d{2}$/.test(value.startTime || "") ? value.startTime : "",
        endTime: /^\d{2}:\d{2}$/.test(value.endTime || "") ? value.endTime : "",
        legacyTime: safeText(value.legacyTime || value.time, 60),
        time: safeText(value.legacyTime || value.time, 60),
        reactions: sanitizeReactionMap(value.reactions)
    };
}

function plansFromData(data = loadData()) {
    return (data.plans || []).map(sanitizePlan).filter(Boolean);
}

function ideasFromData(data = loadData()) {
    return (data.wishlistItems || []).map(sanitizeIdea).filter((idea) => idea && idea.date);
}

function planTimeLabel(plan) {
    if (plan.startTime && plan.endTime) return `${plan.startTime}–${plan.endTime}`;
    if (plan.startTime) return plan.startTime;
    return plan.legacyTime;
}

function planFromForm(form, existing = null) {
    const fields = new FormData(form);
    return sanitizePlan({
        ...(existing || {}),
        id: existing?.id || generateId(),
        createdAt: existing?.createdAt || new Date().toISOString(),
        createdBy: existing?.createdBy || getCurrentIdentity(),
        updatedAt: new Date().toISOString(),
        emoji: fields.get("emoji"),
        category: fields.get("category"),
        title: fields.get("title"),
        description: fields.get("description"),
        date: fields.get("date"),
        startTime: fields.get("startTime"),
        endTime: fields.get("endTime"),
        reactions: existing?.reactions || { Yaoyu: null, Daria: null }
    });
}

function planFormMarkup(plan = null, date = selectedDate) {
    const current = plan || {
        emoji: "📅", category: PLAN_CATEGORIES[0], title: "", description: "", date, startTime: "", endTime: ""
    };
    return `
        <form id="calendar-plan-form" class="form-stack">
            <div class="form-grid">
                <label class="field"><span>Datum *</span><input name="date" type="date" value="${escapeHtml(current.date)}" required></label>
                <label class="field"><span>Emoji *</span><input name="emoji" maxlength="16" value="${escapeHtml(current.emoji)}" required></label>
                <label class="field"><span>Kategorie</span><select name="category">${PLAN_CATEGORIES.map((item) => `<option value="${item}" ${item === current.category ? "selected" : ""}>${item}</option>`).join("")}</select></label>
                <label class="field"><span>Titel *</span><input name="title" maxlength="300" value="${escapeHtml(current.title)}" required></label>
                <label class="field"><span>Beginn</span><input name="startTime" type="time" value="${escapeHtml(current.startTime)}"></label>
                <label class="field"><span>Ende</span><input name="endTime" type="time" value="${escapeHtml(current.endTime)}"></label>
                <label class="field span-two"><span>Notiz</span><textarea name="description" maxlength="1000" rows="3">${escapeHtml(current.description)}</textarea></label>
            </div>
            <p id="calendar-plan-error" class="error-message" aria-live="polite"></p>
            <div class="action-row"><button class="primary-button" type="submit">${plan ? "Plan aktualisieren" : "Plan speichern"}</button></div>
        </form>`;
}

function renderPlanForm(host, plan, context, rerender) {
    host.innerHTML = planFormMarkup(plan, plan?.date || selectedDate);
    const form = host.querySelector("#calendar-plan-form");
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const next = planFromForm(form, plan);
        if (!next) {
            host.querySelector("#calendar-plan-error").textContent = "Bitte prüfe Datum, Titel und Emoji.";
            return;
        }
        updateData((data) => {
            const index = data.plans.findIndex((item) => item.id === next.id);
            if (index >= 0) data.plans[index] = next;
            else data.plans.push(next);
            return data;
        });
        selectedDate = next.date;
        visibleMonth = new Date(dateFromIso(next.date).getFullYear(), dateFromIso(next.date).getMonth(), 1);
        context.toast(plan ? "Plan wurde aktualisiert." : "Plan wurde gespeichert.");
        rerender();
    });
}

function appendPlanItem(parent, plan, context, rerender, editPlan) {
    const item = document.createElement("article");
    item.className = "calendar-event calendar-event-plan";
    const heading = document.createElement("div");
    heading.className = "calendar-event-heading";
    const title = document.createElement("h4");
    title.textContent = `${plan.emoji} ${plan.title}`;
    const badge = document.createElement("span");
    badge.className = "badge plan-color-badge";
    badge.textContent = "Plan";
    heading.append(title, badge);
    item.append(heading);
    const time = planTimeLabel(plan);
    if (time || plan.category) {
        const meta = document.createElement("p");
        meta.className = "meta";
        meta.textContent = [time, plan.category].filter(Boolean).join(" · ");
        item.append(meta);
    }
    if (plan.description) {
        const note = document.createElement("p");
        note.textContent = plan.description;
        item.append(note);
    }
    const actions = document.createElement("div");
    actions.className = "action-row";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary-button";
    edit.textContent = "Bearbeiten";
    edit.addEventListener("click", () => editPlan(plan));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger-button";
    remove.textContent = "Löschen";
    remove.addEventListener("click", () => {
        if (!window.confirm("Möchtest du diesen Plan wirklich für Yaoyu und Daria löschen?")) return;
        updateData((data) => {
            data.plans = data.plans.filter((item) => item.id !== plan.id);
            return data;
        });
        context.toast("Plan wurde gelöscht.");
        rerender();
    });
    actions.append(edit, remove);
    item.append(actions);
    parent.append(item);
}

function appendIdeaItem(parent, idea, context, rerender) {
    const item = document.createElement("article");
    item.className = "calendar-event calendar-event-idea";
    const heading = document.createElement("div");
    heading.className = "calendar-event-heading";
    const title = document.createElement("h4");
    title.textContent = `${idea.emoji} ${idea.title}`;
    const badge = document.createElement("span");
    badge.className = "badge idea-color-badge";
    const state = responseShort(idea.responses);
    badge.textContent = `Unsere Idee${state ? ` · ${state}` : ""}`;
    heading.append(title, badge);
    item.append(heading);
    const metaParts = [];
    if (idea.startTime && idea.endTime) metaParts.push(`${idea.startTime}–${idea.endTime}`);
    else if (idea.startTime) metaParts.push(idea.startTime);
    metaParts.push(idea.type);
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = metaParts.join(" · ");
    item.append(meta);
    if (idea.description) {
        const description = document.createElement("p");
        description.textContent = idea.description;
        item.append(description);
    }
    if (idea.budget) {
        const budget = document.createElement("p");
        budget.className = "idea-budget";
        budget.textContent = `💶 ${idea.budget}`;
        item.append(budget);
    }
    const actions = document.createElement("div");
    actions.className = "action-row";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "secondary-button";
    open.textContent = "Antworten & kommentieren";
    open.addEventListener("click", () => context.navigate("ideas"));
    const removeDate = document.createElement("button");
    removeDate.type = "button";
    removeDate.className = "text-button";
    removeDate.textContent = "Datum entfernen";
    removeDate.addEventListener("click", () => {
        updateData((data) => {
            const index = data.wishlistItems.findIndex((entry) => entry.id === idea.id);
            const current = sanitizeIdea(data.wishlistItems[index]);
            if (!current) return data;
            current.date = "";
            current.startTime = "";
            current.endTime = "";
            current.updatedAt = new Date().toISOString();
            data.wishlistItems[index] = current;
            return data;
        });
        context.toast("Die Idee bleibt erhalten und wurde aus dem Kalender entfernt.");
        rerender();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger-button";
    remove.textContent = "Idee löschen";
    remove.addEventListener("click", () => {
        if (!window.confirm("Möchtest du diese Idee wirklich vollständig löschen?")) return;
        updateData((data) => {
            data.wishlistItems = data.wishlistItems.filter((entry) => entry.id !== idea.id);
            return data;
        });
        context.toast("Idee wurde gelöscht.");
        rerender();
    });
    actions.append(open, removeDate, remove);
    item.append(actions);
    parent.append(item);
}

function calendarMoodRow(identity, mood) {
    const row = document.createElement("span");
    row.className = `combined-calendar-mood combined-calendar-${identity.toLowerCase()}`;
    row.textContent = mood?.emoji || "·";
    row.setAttribute("aria-label", mood ? `${identity}: ${mood.emoji}` : `${identity}: kein Eintrag`);
    return row;
}

function eventSummaryForDate(date, plans, ideas) {
    const events = [
        ...plans.filter((plan) => plan.date === date).map((plan) => ({ kind: "plan", emoji: plan.emoji, title: plan.title, time: planTimeLabel(plan) })),
        ...ideas.filter((idea) => idea.date === date).map((idea) => ({ kind: "idea", emoji: idea.emoji, title: idea.title, time: idea.startTime }))
    ].sort((left, right) => String(left.time || "99:99").localeCompare(String(right.time || "99:99")));
    return events;
}

function renderCalendarGrid(container, data, context, rerender) {
    const plans = plansFromData(data);
    const ideas = ideasFromData(data);
    const title = container.querySelector("#combined-calendar-title");
    const grid = container.querySelector("#combined-calendar-grid");
    title.textContent = visibleMonth.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    grid.replaceChildren();
    WEEKDAYS.forEach((weekday) => {
        const label = document.createElement("div");
        label.className = "combined-calendar-weekday";
        label.textContent = weekday;
        grid.append(label);
    });
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const leading = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    for (let index = 0; index < leading; index += 1) {
        const blank = document.createElement("span");
        blank.className = "combined-calendar-day empty";
        grid.append(blank);
    }
    for (let day = 1; day <= days; day += 1) {
        const date = isoFromParts(year, month, day);
        const yaoyuMood = moodForDate("Yaoyu", date, data);
        const dariaMood = moodForDate("Daria", date, data);
        const events = eventSummaryForDate(date, plans, ideas);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "combined-calendar-day";
        button.classList.toggle("today", date === localToday());
        button.classList.toggle("selected", date === selectedDate);
        const number = document.createElement("span");
        number.className = "combined-calendar-number";
        number.textContent = String(day);
        const rows = document.createElement("span");
        rows.className = "combined-calendar-rows";
        rows.append(calendarMoodRow("Yaoyu", yaoyuMood), calendarMoodRow("Daria", dariaMood));
        const eventRow = document.createElement("span");
        eventRow.className = "combined-calendar-event-row";
        if (!events.length) {
            eventRow.textContent = "·";
        } else {
            const first = events[0];
            eventRow.classList.add(first.kind === "plan" ? "event-plan" : "event-idea");
            const summary = document.createElement("span");
            summary.className = "combined-calendar-event-summary";

            const emoji = document.createElement("span");
            emoji.className = "combined-calendar-event-emoji";
            emoji.textContent = first.emoji || (first.kind === "plan" ? "📅" : "💡");

            const text = document.createElement("span");
            text.className = "combined-calendar-event-text";
            text.textContent = `${first.time ? `${first.time} ` : ""}${first.title}`;

            summary.append(emoji, text);
            eventRow.append(summary);
            eventRow.setAttribute("aria-label", `${first.kind === "plan" ? "Plan" : "Idee"}: ${text.textContent}`);
            if (events.length > 1) {
                const more = document.createElement("b");
                more.textContent = `+${events.length - 1}`;
                eventRow.append(more);
            }
        }
        rows.append(eventRow);
        button.append(number, rows);
        button.setAttribute("aria-label", `${formatSelectedDate(date)}; ${events.length} Einträge`);
        button.addEventListener("click", () => {
            selectedDate = date;
            rerender();
        });
        grid.append(button);
    }
}

function renderDayDetails(container, data, context, rerender) {
    const plans = plansFromData(data).filter((plan) => plan.date === selectedDate)
        .sort((left, right) => String(planTimeLabel(left)).localeCompare(String(planTimeLabel(right))));
    const ideas = ideasFromData(data).filter((idea) => idea.date === selectedDate)
        .sort((left, right) => String(left.startTime).localeCompare(String(right.startTime)));
    const host = container.querySelector("#selected-day-details");
    host.innerHTML = `
        <div class="section-heading">
            <div><p class="eyebrow">AUSGEWÄHLTER TAG</p><h2>${escapeHtml(formatSelectedDate(selectedDate))}</h2></div>
            <button id="add-plan-for-day" class="primary-button" type="button">+ Plan</button>
        </div>
        <div id="plan-form-host" class="module-card inline-plan-form" hidden></div>
        <div class="selected-day-columns">
            <section><h3>Pläne <span class="badge">${plans.length}</span></h3><div id="selected-plans" class="calendar-event-list"></div></section>
            <section><h3>Unsere Ideen <span class="badge">${ideas.length}</span></h3><div id="selected-ideas" class="calendar-event-list"></div></section>
        </div>`;
    const formHost = host.querySelector("#plan-form-host");
    const openPlanForm = (plan = null) => {
        formHost.hidden = false;
        renderPlanForm(formHost, plan, context, rerender);
        formHost.querySelector('input[name="title"]')?.focus();
    };
    host.querySelector("#add-plan-for-day").addEventListener("click", () => openPlanForm());
    const planList = host.querySelector("#selected-plans");
    const ideaList = host.querySelector("#selected-ideas");
    if (!plans.length) planList.innerHTML = '<p class="empty-state">Noch kein normaler Plan für diesen Tag.</p>';
    else plans.forEach((plan) => appendPlanItem(planList, plan, context, rerender, openPlanForm));
    if (!ideas.length) ideaList.innerHTML = '<p class="empty-state">Keine datierte Idee für diesen Tag.</p>';
    else ideas.forEach((idea) => appendIdeaItem(ideaList, idea, context, rerender));
}

export function renderStart(container, context) {
    const prefill = context.consumePrefill?.("home") || null;
    if (prefill && isIsoDate(prefill.date)) {
        selectedDate = prefill.date;
        const chosen = dateFromIso(selectedDate);
        visibleMonth = new Date(chosen.getFullYear(), chosen.getMonth(), 1);
    }
    const rerender = () => renderStart(container, context);
    const data = loadData();
    const days = relationshipDays();
    container.innerHTML = `
        <section class="home-hero new-home-hero">
            <article id="love-quote-card" class="card love-quote-card">
                <div class="quote-toolbar">
                    <div><p class="eyebrow">中乌双语 · 中文 / УКРАЇНСЬКА</p><span id="quote-counter" class="quote-counter"></span></div>
                    <div class="quote-arrows" aria-label="情话切换">
                        <button id="quote-previous" type="button" aria-label="上一句">▲</button>
                        <button id="quote-next" type="button" aria-label="下一句">▼</button>
                    </div>
                </div>
                <blockquote id="quote-zh" class="quote-zh"></blockquote>
                <blockquote id="quote-uk" class="quote-uk" lang="uk"></blockquote>
                <div class="quote-source"><span id="quote-source-zh"></span><span id="quote-source-uk" lang="uk"></span></div>
            </article>
            <aside class="card relationship-card">
                <p class="eyebrow">YAOYU ♡ DARIA</p>
                <div class="relationship-number">${days}</div>
                <div class="relationship-bilingual"><p>我们在一起的第 ${days} 天</p><p lang="uk">Ми разом уже ${days} днів</p></div>
            </aside>
        </section>

        <section id="home-mood-editor" class="module-card home-mood-editor"></section>

        <section class="combined-calendar-section">
            <div class="section-heading">
                <div><p class="eyebrow">GEMEINSAMER KALENDER</p><h2>Stimmungen, Pläne und Ideen</h2></div>
                <button id="calendar-today" class="secondary-button" type="button">Heute</button>
            </div>
            <div class="calendar-legend">
                <span class="legend-yaoyu">Yaoyu</span>
                <span class="legend-daria">Daria</span>
                <span class="legend-plan">Normaler Plan</span>
                <span class="legend-idea">Unsere Idee</span>
            </div>
            <article class="combined-calendar-card">
                <div class="calendar-controls">
                    <button id="combined-previous-month" class="icon-button" type="button" aria-label="Vorheriger Monat">←</button>
                    <h2 id="combined-calendar-title"></h2>
                    <button id="combined-next-month" class="icon-button" type="button" aria-label="Nächster Monat">→</button>
                </div>
                <div id="combined-calendar-grid" class="combined-calendar-grid"></div>
            </article>
        </section>

        <section id="selected-day-details" class="module-card selected-day-details"></section>`;

    renderQuoteCard(container);
    renderMoodEditor(container.querySelector("#home-mood-editor"), selectedDate, context, rerender);
    renderCalendarGrid(container, data, context, rerender);
    renderDayDetails(container, data, context, rerender);

    container.querySelector("#combined-previous-month").addEventListener("click", () => {
        visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
        rerender();
    });
    container.querySelector("#combined-next-month").addEventListener("click", () => {
        visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
        rerender();
    });
    container.querySelector("#calendar-today").addEventListener("click", () => {
        selectedDate = localToday();
        const today = dateFromIso(selectedDate);
        visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        rerender();
    });
}

// Alte Routen und geteilte Plan-Links bleiben lesbar.
export function renderCalendar(container, context) {
    renderStart(container, context);
}

export function sanitizeSharedPlan(value) {
    const plan = sanitizePlan(value);
    if (!plan) throw new Error("INVALID_PLAN");
    return plan;
}

export function renderPlanShare(container, rawPayload, context) {
    const plan = sanitizePlan(rawPayload);
    if (!plan) {
        context.renderShareError();
        return;
    }
    container.innerHTML = `
        <header class="page-header"><p class="eyebrow">GETEILTER PLAN</p><h1>${escapeHtml(plan.emoji)} ${escapeHtml(plan.title)}</h1></header>
        <section class="module-card">
            <p class="meta">${escapeHtml(formatDate(plan.date, { weekday: "long" }))}${planTimeLabel(plan) ? ` · ${escapeHtml(planTimeLabel(plan))}` : ""}</p>
            ${plan.description ? `<p>${escapeHtml(plan.description)}</p>` : ""}
            <div class="action-row"><button id="save-shared-plan" class="primary-button" type="button">Im Kalender speichern</button><button class="secondary-button" type="button" data-route="home">Abbrechen</button></div>
        </section>`;
    container.querySelector("#save-shared-plan").addEventListener("click", () => {
        updateData((data) => {
            const index = data.plans.findIndex((item) => item.id === plan.id);
            if (index >= 0) data.plans[index] = plan;
            else data.plans.push(plan);
            return data;
        });
        context.toast("Geteilter Plan wurde gespeichert.");
        context.clearShare();
    });
}

export function stopStartTimers() {
    window.clearInterval(quoteTimer);
    quoteTimer = null;
}
