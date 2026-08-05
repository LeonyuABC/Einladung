import {
    clone,
    formatDate,
    generateId,
    getCurrentIdentity,
    getOppositeIdentity,
    isIdentity,
    isIsoDate,
    loadData,
    localToday,
    safeText,
    updateData
} from "./storage.js";
import { isPlainObject } from "./share.js";
import { PLAN_CATEGORIES } from "./calendar.js";

const TIMES = ["Vormittags", "Nachmittags", "Abends", "Ganzer Tag", "Egal", "Keine Auswahl"];
const ACTIVITIES = [
    "🎬 Kino",
    "☕ Café",
    "🌿 Spazieren gehen",
    "🍕 Etwas essen",
    "📚 Zusammen lernen",
    "🍳 Zusammen kochen",
    "🎮 Spieleabend",
    "🚆 Ausflug",
    "🎲 Überrasch mich",
    "✨ Etwas anderes"
];

function categoryOptions() {
    return PLAN_CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("");
}

function timeOptions(includeEmpty = true) {
    const values = includeEmpty ? ["", ...TIMES.slice(0, -1)] : TIMES;
    return values.map((time) => `<option value="${time}">${time || "Keine Auswahl"}</option>`).join("");
}

function safeDateChoice(value) {
    if (isIsoDate(value)) return value;
    return ["Überlass es mir", "Keine Auswahl"].includes(value) ? value : "Keine Auswahl";
}

function displayDateChoice(value) {
    return isIsoDate(value) ? formatDate(value, { weekday: "long" }) : value;
}

export function sanitizeInvitation(value) {
    if (!isPlainObject(value) || value.kind !== "INVITATION") throw new Error("INVALID_INVITATION");
    const id = safeText(value.id || value.invitationId, 1000);
    if (!id || !["OPEN_SELECTION", "CONCRETE_IDEA"].includes(value.type) || !isIdentity(value.createdBy) || !isIdentity(value.recipient)) {
        throw new Error("INVALID_INVITATION");
    }
    const base = {
        kind: "INVITATION",
        type: value.type,
        id,
        invitationId: id,
        createdBy: value.createdBy,
        recipient: value.recipient,
        createdAt: safeText(value.createdAt, 50) || new Date().toISOString(),
        message: safeText(value.message, 300),
        response: null
    };
    if (value.type === "CONCRETE_IDEA") {
        const activity = safeText(value.activity, 300);
        if (!activity) throw new Error("INVALID_INVITATION");
        Object.assign(base, {
            emoji: safeText(value.emoji, 12, "💌") || "💌",
            category: safeText(value.category, 80, "✨ Sonstiges"),
            activity,
            date: isIsoDate(value.date) ? value.date : "",
            time: safeText(value.time, 50),
            note: safeText(value.note, 300)
        });
    }
    if (value.response) {
        try { base.response = sanitizeInvitationResponse(value.response); } catch (error) { base.response = null; }
    }
    return base;
}

export function sanitizeInvitationResponse(value) {
    if (!isPlainObject(value) || value.kind !== "INVITATION_RESPONSE") throw new Error("INVALID_RESPONSE");
    if (!["OPEN_SELECTION_RESPONSE", "CONCRETE_RESPONSE"].includes(value.type)) throw new Error("INVALID_RESPONSE");
    const invitationId = safeText(value.invitationId, 1000);
    if (!invitationId || !isIdentity(value.originalCreator) || !isIdentity(value.respondedBy)) throw new Error("INVALID_RESPONSE");
    const response = {
        kind: "INVITATION_RESPONSE",
        type: value.type,
        id: safeText(value.id, 1000) || generateId(),
        invitationId,
        originalCreator: value.originalCreator,
        respondedBy: value.respondedBy,
        respondedAt: safeText(value.respondedAt, 50) || new Date().toISOString(),
        originalInvitation: null
    };
    if (value.type === "OPEN_SELECTION_RESPONSE") {
        response.dateChoice = safeDateChoice(value.dateChoice);
        response.timeChoice = TIMES.includes(value.timeChoice) ? value.timeChoice : "Keine Auswahl";
        response.activities = Array.isArray(value.activities)
            ? value.activities.filter((item) => ACTIVITIES.includes(item)).slice(0, ACTIVITIES.length)
            : [];
        response.otherActivityText = safeText(value.otherActivityText, 300);
    } else {
        if (!["HEART", "NO_TIME", "OTHER_DATE"].includes(value.answer)) throw new Error("INVALID_RESPONSE");
        response.answer = value.answer;
        response.suggestedDate = value.answer === "OTHER_DATE" && isIsoDate(value.suggestedDate) ? value.suggestedDate : "";
    }
    if (value.originalInvitation) {
        try { response.originalInvitation = sanitizeInvitation(value.originalInvitation); } catch (error) { response.originalInvitation = null; }
    }
    return response;
}

function createOpenInvitation(form) {
    const id = generateId();
    return {
        kind: "INVITATION",
        type: "OPEN_SELECTION",
        id,
        invitationId: id,
        createdBy: getCurrentIdentity(),
        recipient: getOppositeIdentity(),
        createdAt: new Date().toISOString(),
        message: safeText(new FormData(form).get("message"), 300),
        response: null
    };
}

function createConcreteInvitation(form) {
    const fields = new FormData(form);
    const id = generateId();
    return {
        kind: "INVITATION",
        type: "CONCRETE_IDEA",
        id,
        invitationId: id,
        createdBy: getCurrentIdentity(),
        recipient: getOppositeIdentity(),
        createdAt: new Date().toISOString(),
        message: "",
        emoji: safeText(fields.get("emoji"), 12, "💌") || "💌",
        category: safeText(fields.get("category"), 80),
        activity: safeText(fields.get("activity"), 300),
        date: isIsoDate(fields.get("date")) ? fields.get("date") : "",
        time: safeText(fields.get("time"), 50),
        note: safeText(fields.get("note"), 300),
        response: null
    };
}

function saveNewInvitation(invitation) {
    updateData((data) => {
        data.invitations.push(clone(invitation));
        return data;
    });
}

function responseSummary(response) {
    if (response.type === "OPEN_SELECTION_RESPONSE") {
        const activities = response.activities.length ? response.activities.join(", ") : "Keine Auswahl";
        return `${displayDateChoice(response.dateChoice)} · ${response.timeChoice} · ${activities}`;
    }
    if (response.answer === "HEART") return "❤️ Passt mir";
    if (response.answer === "NO_TIME") return "🥀 Keine Zeit";
    return `🔁 ${formatDate(response.suggestedDate)}`;
}

function responseToPlanPrefill(response) {
    const invitation = response.originalInvitation;
    if (response.type === "OPEN_SELECTION_RESPONSE") {
        return {
            date: isIsoDate(response.dateChoice) ? response.dateChoice : "",
            emoji: response.activities[0]?.split(" ")[0] || "💌",
            category: "🎬 Freizeit",
            activity: response.activities.length ? response.activities.join(", ") : "Gemeinsame Aktivität",
            note: response.otherActivityText
        };
    }
    return {
        date: response.answer === "OTHER_DATE" ? response.suggestedDate : invitation?.date || "",
        emoji: invitation?.emoji || "💌",
        category: invitation?.category || "✨ Sonstiges",
        activity: invitation?.activity || "Gemeinsame Aktivität",
        note: invitation?.note || ""
    };
}

function appendInvitationCard(parent, invitation, context, rerender, answerInvitation) {
    const card = document.createElement("article");
    card.className = "list-card";
    const heading = document.createElement("div");
    heading.className = "card-heading";
    const title = document.createElement("h3");
    title.className = "emoji-title";
    const emoji = document.createElement("span");
    emoji.className = "emoji";
    emoji.textContent = invitation.type === "OPEN_SELECTION" ? "💌" : invitation.emoji;
    const text = document.createElement("span");
    text.textContent = invitation.type === "OPEN_SELECTION" ? "Gemeinsam auswählen" : invitation.activity;
    title.append(emoji, text);
    const badge = document.createElement("span");
    badge.className = `badge${invitation.response ? " success" : ""}`;
    badge.textContent = invitation.response ? "Antwort erhalten" : "Offen";
    heading.append(title, badge);
    card.append(heading);

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `Von ${invitation.createdBy} für ${invitation.recipient} · ${new Date(invitation.createdAt).toLocaleDateString("de-DE")}`;
    card.append(meta);
    if (invitation.type === "OPEN_SELECTION" && invitation.message) {
        const message = document.createElement("p");
        message.textContent = invitation.message;
        card.append(message);
    }
    if (invitation.type === "CONCRETE_IDEA") {
        const detail = document.createElement("p");
        detail.textContent = `${invitation.category}${invitation.date ? ` · ${formatDate(invitation.date)}` : ""}${invitation.time ? ` · ${invitation.time}` : ""}`;
        card.append(detail);
        if (invitation.note) {
            const note = document.createElement("p");
            note.textContent = invitation.note;
            card.append(note);
        }
    }
    if (invitation.response) {
        const answer = document.createElement("div");
        answer.className = "success-notice";
        answer.textContent = `${invitation.response.respondedBy}: ${responseSummary(invitation.response)}`;
        card.append(answer);
    }

    const actions = document.createElement("div");
    actions.className = "action-row";
    if (!invitation.response && invitation.recipient === getCurrentIdentity()) {
        const answer = document.createElement("button");
        answer.type = "button";
        answer.className = "primary-button";
        answer.textContent = "Antworten";
        answer.addEventListener("click", () => answerInvitation(invitation));
        actions.append(answer);
    }
    if (invitation.response) {
        const plan = document.createElement("button");
        plan.type = "button";
        plan.className = "primary-button";
        plan.textContent = "Als Plan speichern";
        plan.addEventListener("click", () => context.navigate("calendar", responseToPlanPrefill(invitation.response)));
        actions.append(plan);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger-button";
    remove.textContent = "Für beide löschen";
    remove.addEventListener("click", () => {
        if (!window.confirm("Diese Einladung für beide Personen auf allen Geräten löschen?")) return;
        updateData((data) => {
            data.invitations = data.invitations.filter((item) => item.id !== invitation.id);
            return data;
        });
        context.toast("Einladung wird auf allen Geräten gelöscht.");
        rerender();
    });
    actions.append(remove);
    card.append(actions);
    parent.append(card);
}

export function renderInvitations(container, context) {
    const rerender = () => renderInvitations(container, context);
    const answerInvitation = (invitation) => {
        renderInvitationShare(container, { ...invitation, response: null }, "invite", context);
        container.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const prefill = context.consumePrefill?.("invitations") || {};
    const invitations = loadData().invitations.flatMap((item) => {
        try { return [sanitizeInvitation({ kind: "INVITATION", ...item })]; } catch (error) { return []; }
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    container.innerHTML = `
        <header class="page-header"><p class="eyebrow">EINLADUNG</p><h1>Was machen wir zusammen?</h1><p class="muted">Erstelle eine Einladung. Sie erscheint automatisch bei der anderen Person – ohne Link und ohne E-Mail.</p></header>
        <div class="choice-launcher">
            <button id="choose-open" type="button"><span>💌</span><strong>Gemeinsam auswählen</strong><span>Die andere Person wählt Datum, Zeit und Aktivitäten.</span></button>
            <button id="choose-concrete" type="button"><span>✨</span><strong>Konkrete Idee</strong><span>Schlage eine fertige Aktivität mit optionalem Termin vor.</span></button>
        </div>
        <section id="open-invite-card" class="module-card" hidden>
            <div class="section-heading"><h2>Offene Einladung</h2><button class="icon-button close-invite-form" type="button" aria-label="Formular schließen">×</button></div>
            <form id="open-invite-form" class="form-stack">
                <label class="field"><span>Optionale Nachricht</span><textarea name="message" maxlength="300" placeholder="Zum Beispiel: Such dir etwas Schönes aus ..."></textarea></label>
                <p class="small-note">Empfänger: ${getOppositeIdentity()}</p>
                <div class="action-row"><button class="primary-button" type="submit">Einladung speichern</button></div>
            </form>
        </section>
        <section id="concrete-invite-card" class="module-card" hidden>
            <div class="section-heading"><h2>Konkrete Idee</h2><button class="icon-button close-invite-form" type="button" aria-label="Formular schließen">×</button></div>
            <form id="concrete-invite-form" class="form-stack">
                <div class="form-grid">
                    <label class="field"><span>Emoji *</span><input name="emoji" type="text" maxlength="12" value="💌" required></label>
                    <label class="field"><span>Kategorie *</span><select name="category" required>${categoryOptions()}</select></label>
                    <label class="field span-two"><span>Konkrete Aktivität *</span><input name="activity" type="text" maxlength="300" required></label>
                    <label class="field"><span>Datum</span><input name="date" type="date" min="${localToday()}"></label>
                    <label class="field"><span>Zeit</span><select name="time">${timeOptions(true)}</select></label>
                    <label class="field span-two"><span>Notiz</span><textarea name="note" maxlength="300"></textarea></label>
                </div>
                <p id="concrete-error" class="error-message" aria-live="polite"></p>
                <div class="action-row"><button class="primary-button" type="submit">Einladung speichern</button></div>
            </form>
        </section>
        <section style="margin-top:28px">
            <div class="section-heading"><h2>Gemeinsame Einladungen</h2><span class="badge">${invitations.length}</span></div>
            <div id="invitation-list" class="list-stack"></div>
        </section>
        <div class="action-row" style="margin-top:20px"><button class="secondary-button" type="button" data-route="home">← Zur Startseite</button></div>`;

    const openCard = container.querySelector("#open-invite-card");
    const concreteCard = container.querySelector("#concrete-invite-card");
    function showForm(type) {
        openCard.hidden = type !== "open";
        concreteCard.hidden = type !== "concrete";
        container.querySelector("#choose-open").classList.toggle("selected", type === "open");
        container.querySelector("#choose-concrete").classList.toggle("selected", type === "concrete");
        (type === "open" ? openCard : concreteCard).querySelector("input, textarea, select")?.focus();
    }
    container.querySelector("#choose-open").addEventListener("click", () => showForm("open"));
    container.querySelector("#choose-concrete").addEventListener("click", () => showForm("concrete"));
    container.querySelectorAll(".close-invite-form").forEach((button) => button.addEventListener("click", () => {
        openCard.hidden = true;
        concreteCard.hidden = true;
        container.querySelectorAll(".choice-launcher button").forEach((item) => item.classList.remove("selected"));
    }));

    if (prefill.mode === "concrete") {
        showForm("concrete");
        const form = container.querySelector("#concrete-invite-form");
        form.elements.emoji.value = safeText(prefill.emoji, 12, "💌") || "💌";
        if (PLAN_CATEGORIES.includes(prefill.category)) form.elements.category.value = prefill.category;
        form.elements.activity.value = safeText(prefill.activity, 300);
        form.elements.note.value = safeText(prefill.note, 300);
    }

    container.querySelector("#open-invite-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const invitation = createOpenInvitation(event.currentTarget);
        saveNewInvitation(invitation);
        context.toast("Einladung wird für euch beide synchronisiert.");
        rerender();
    });
    container.querySelector("#concrete-invite-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const invitation = createConcreteInvitation(form);
        if (!invitation.activity) {
            container.querySelector("#concrete-error").textContent = "Bitte beschreibe die Aktivität.";
            return;
        }
        saveNewInvitation(invitation);
        context.toast("Einladung wird für euch beide synchronisiert.");
        rerender();
    });

    const list = container.querySelector("#invitation-list");
    if (!invitations.length) {
        list.innerHTML = '<div class="module-card empty-state">Noch keine gemeinsamen Einladungen.</div>';
    } else {
        invitations.forEach((invitation) => appendInvitationCard(list, invitation, context, rerender, answerInvitation));
    }
}

function renderResponseActions(container, invitation, response, context) {
    container.innerHTML = `
        <div class="step-indicator"><span class="active"></span><span class="active"></span><span class="active"></span></div>
        <h2>Antwort ist bereit</h2>
        <div class="success-notice" id="response-summary"></div>
        <p class="muted">Speichere die Antwort. Sie erscheint automatisch auf beiden Geräten.</p>
        <div class="action-row">
            <button id="save-invite-response-direct" class="primary-button" type="button">Antwort gemeinsam speichern</button>
            <button class="text-button" type="button" data-route="invitations">Abbrechen</button>
        </div>
        <p id="response-save-error" class="error-message" aria-live="polite"></p>`;
    container.querySelector("#response-summary").textContent = responseSummary(response);
    container.querySelector("#save-invite-response-direct").addEventListener("click", (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            saveImportedResponse(response, true);
            context.toast("Antwort wird für euch beide synchronisiert.");
            context.navigate("invitations");
        } catch (error) {
            console.error("Einladungsantwort konnte nicht gespeichert werden.", error);
            container.querySelector("#response-save-error").textContent = "Die Antwort konnte nicht gespeichert werden. Bitte versuche es erneut.";
            button.disabled = false;
        }
    });
}

function renderOpenInvitationShare(container, invitation, context) {
    const state = { dateChoice: "", timeChoice: "Keine Auswahl", activities: new Set(), otherActivityText: "" };
    container.innerHTML = `
        <header class="page-header"><p class="eyebrow">EINLADUNG VON <span id="open-invite-from"></span></p><h1>Such dir etwas Schönes aus</h1><p id="open-invite-message" class="muted"></p></header>
        <section class="module-card" id="invite-wizard"></section>`;
    container.querySelector("#open-invite-from").textContent = invitation.createdBy;
    container.querySelector("#open-invite-message").textContent = invitation.message || `${invitation.createdBy} möchte Zeit mit dir verbringen.`;
    const wizard = container.querySelector("#invite-wizard");

    function stepOne() {
        wizard.innerHTML = `
            <div class="step-indicator"><span class="active"></span><span></span><span></span></div>
            <h2>1. Datum und Zeit</h2>
            <form id="invite-date-form" class="form-stack">
                <fieldset><legend>Datum</legend><div class="choice-pills">
                    <label class="choice-pill"><input type="radio" name="dateMode" value="specific" checked><span>Konkretes Datum</span></label>
                    <label class="choice-pill"><input type="radio" name="dateMode" value="delegate"><span>Überlass es mir</span></label>
                    <label class="choice-pill"><input type="radio" name="dateMode" value="skip"><span>Überspringen</span></label>
                </div></fieldset>
                <label id="invite-date-field" class="field"><span>Tag auswählen</span><input name="date" type="date" min="${localToday()}"></label>
                <label class="field"><span>Zeit</span><select name="time">${timeOptions(false)}</select></label>
                <p id="invite-date-error" class="error-message" aria-live="polite"></p>
                <div class="action-row"><button class="primary-button" type="submit">Weiter</button></div>
            </form>`;
        const form = wizard.querySelector("#invite-date-form");
        const dateField = wizard.querySelector("#invite-date-field");
        form.querySelectorAll('[name="dateMode"]').forEach((radio) => radio.addEventListener("change", () => {
            dateField.hidden = radio.value !== "specific";
        }));
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const fields = new FormData(form);
            const mode = fields.get("dateMode");
            const date = fields.get("date");
            if (mode === "specific" && !isIsoDate(date)) {
                wizard.querySelector("#invite-date-error").textContent = "Bitte wähle ein Datum oder eine andere Option.";
                return;
            }
            state.dateChoice = mode === "specific" ? date : mode === "delegate" ? "Überlass es mir" : "Keine Auswahl";
            state.timeChoice = TIMES.includes(fields.get("time")) ? fields.get("time") : "Keine Auswahl";
            stepTwo();
        });
    }

    function stepTwo() {
        wizard.innerHTML = `
            <div class="step-indicator"><span class="active"></span><span class="active"></span><span></span></div>
            <h2>2. Aktivitäten</h2>
            <p class="muted">Mehrere Antworten sind möglich.</p>
            <div id="invite-activity-options" class="activity-options"></div>
            <label id="other-activity-field" class="field" hidden style="margin-top:14px"><span>Etwas anderes</span><input id="other-activity-text" type="text" maxlength="300"></label>
            <div class="action-row" style="margin-top:18px">
                <button id="finish-activities" class="primary-button" type="button">Auswahl übernehmen</button>
                <button id="skip-activities" class="secondary-button" type="button">Ohne Auswahl fortfahren</button>
                <button id="back-to-date" class="text-button" type="button">← Zurück</button>
            </div>`;
        const options = wizard.querySelector("#invite-activity-options");
        ACTIVITIES.forEach((activity) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "activity-choice";
            button.textContent = activity;
            button.addEventListener("click", () => {
                if (state.activities.has(activity)) state.activities.delete(activity); else state.activities.add(activity);
                button.classList.toggle("selected", state.activities.has(activity));
                if (activity === "✨ Etwas anderes") wizard.querySelector("#other-activity-field").hidden = !state.activities.has(activity);
            });
            options.append(button);
        });
        function finish(skip) {
            if (skip) state.activities.clear();
            state.otherActivityText = state.activities.has("✨ Etwas anderes")
                ? safeText(wizard.querySelector("#other-activity-text").value, 300)
                : "";
            const response = {
                kind: "INVITATION_RESPONSE",
                type: "OPEN_SELECTION_RESPONSE",
                id: generateId(),
                invitationId: invitation.id,
                originalCreator: invitation.createdBy,
                respondedBy: getCurrentIdentity(),
                dateChoice: state.dateChoice,
                timeChoice: state.timeChoice,
                activities: Array.from(state.activities),
                otherActivityText: state.otherActivityText,
                respondedAt: new Date().toISOString(),
                originalInvitation: { ...invitation, response: null }
            };
            renderResponseActions(wizard, invitation, response, context);
        }
        wizard.querySelector("#finish-activities").addEventListener("click", () => finish(false));
        wizard.querySelector("#skip-activities").addEventListener("click", () => finish(true));
        wizard.querySelector("#back-to-date").addEventListener("click", stepOne);
    }
    stepOne();
}

function renderConcreteInvitationShare(container, invitation, context) {
    container.innerHTML = `
        <header class="page-header"><p class="eyebrow">EINLADUNG VON <span id="concrete-from"></span></p><h1 id="concrete-title"></h1><p class="muted">Wie passt dir diese Idee?</p></header>
        <section class="module-card">
            <div class="share-preview"><dl><dt>Kategorie</dt><dd id="concrete-category"></dd><dt>Datum</dt><dd id="concrete-date"></dd><dt>Zeit</dt><dd id="concrete-time"></dd><dt>Notiz</dt><dd id="concrete-note"></dd></dl></div>
            <form id="concrete-response-form" class="form-stack" style="margin-top:18px">
                <fieldset><legend>Deine Antwort</legend><div class="choice-pills">
                    <label class="choice-pill"><input type="radio" name="answer" value="HEART" required><span>❤️ Passt mir</span></label>
                    <label class="choice-pill"><input type="radio" name="answer" value="NO_TIME"><span>🥀 Keine Zeit</span></label>
                    <label class="choice-pill"><input type="radio" name="answer" value="OTHER_DATE"><span>🔁 Anderen Tag vorschlagen</span></label>
                </div></fieldset>
                <label id="concrete-suggested-field" class="field" hidden><span>Anderes Datum</span><input name="suggestedDate" type="date" min="${localToday()}"></label>
                <p id="concrete-response-error" class="error-message" aria-live="polite"></p>
                <div class="action-row"><button class="primary-button" type="submit">Antwort erstellen</button><button class="text-button" type="button" data-route="home">Abbrechen</button></div>
            </form>
            <div id="concrete-response-result" hidden></div>
        </section>`;
    container.querySelector("#concrete-from").textContent = invitation.createdBy;
    container.querySelector("#concrete-title").textContent = `${invitation.emoji} ${invitation.activity}`;
    container.querySelector("#concrete-category").textContent = invitation.category;
    container.querySelector("#concrete-date").textContent = invitation.date ? formatDate(invitation.date, { weekday: "long" }) : "Keine Auswahl";
    container.querySelector("#concrete-time").textContent = invitation.time || "Keine Auswahl";
    container.querySelector("#concrete-note").textContent = invitation.note || "Keine Notiz";
    const form = container.querySelector("#concrete-response-form");
    const suggestedField = container.querySelector("#concrete-suggested-field");
    form.querySelectorAll('[name="answer"]').forEach((radio) => radio.addEventListener("change", () => {
        suggestedField.hidden = radio.value !== "OTHER_DATE";
    }));
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const fields = new FormData(form);
        const answer = fields.get("answer");
        const suggestedDate = fields.get("suggestedDate");
        if (answer === "OTHER_DATE" && !isIsoDate(suggestedDate)) {
            container.querySelector("#concrete-response-error").textContent = "Bitte wähle ein vorgeschlagenes Datum.";
            return;
        }
        const response = {
            kind: "INVITATION_RESPONSE",
            type: "CONCRETE_RESPONSE",
            id: generateId(),
            invitationId: invitation.id,
            originalCreator: invitation.createdBy,
            respondedBy: getCurrentIdentity(),
            answer,
            suggestedDate: answer === "OTHER_DATE" ? suggestedDate : "",
            respondedAt: new Date().toISOString(),
            originalInvitation: { ...invitation, response: null }
        };
        form.hidden = true;
        const result = container.querySelector("#concrete-response-result");
        result.hidden = false;
        renderResponseActions(result, invitation, response, context);
    });
}

function sameResponse(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function saveImportedResponse(response, useShared = false) {
    updateData((data) => {
        const index = data.invitations.findIndex((item) => item.id === response.invitationId);
        if (index >= 0) {
            if (!data.invitations[index].response || useShared) data.invitations[index].response = clone(response);
            return data;
        }
        let invitation = response.originalInvitation;
        if (!invitation) {
            invitation = {
                kind: "INVITATION",
                type: response.type === "OPEN_SELECTION_RESPONSE" ? "OPEN_SELECTION" : "CONCRETE_IDEA",
                id: response.invitationId,
                invitationId: response.invitationId,
                createdBy: response.originalCreator,
                recipient: response.respondedBy,
                createdAt: response.respondedAt,
                message: "Importierte Antwort",
                emoji: "💌",
                category: "✨ Sonstiges",
                activity: "Importierte Einladung",
                date: "",
                time: "",
                note: "",
                response: null
            };
        }
        const clean = sanitizeInvitation(invitation);
        clean.response = clone(response);
        data.invitations.push(clean);
        return data;
    });
}

function renderInvitationResponseShare(container, rawResponse, context) {
    let response;
    try {
        response = sanitizeInvitationResponse(rawResponse);
    } catch (error) {
        context.renderShareError();
        return;
    }
    const localInvitation = loadData().invitations.find((item) => item.id === response.invitationId);
    const conflict = Boolean(localInvitation?.response && !sameResponse(localInvitation.response, response));
    container.innerHTML = `
        <header class="page-header"><p class="eyebrow">EINLADUNGSANTWORT</p><h1>Eine Antwort ist angekommen</h1><p class="muted">Prüfe sie, bevor du sie in euren gemeinsamen Einladungen speicherst.</p></header>
        <section class="module-card">
            <div class="share-preview"><dl><dt>Geteilt von</dt><dd id="response-by"></dd><dt>Typ</dt><dd>Einladungsantwort</dd><dt>Inhalt</dt><dd id="response-content"></dd></dl></div>
            <div id="response-conflict" class="warning-notice" ${conflict ? "" : "hidden"} style="margin-top:16px">Für diese Einladung gibt es bereits eine andere Antwort. Wähle eine Version.</div>
            <div class="action-row" style="margin-top:18px">
                <button id="save-invite-response" class="primary-button" type="button">In meinen Einladungen speichern</button>
                <button id="response-as-plan" class="secondary-button" type="button">Als Plan speichern</button>
                <button class="text-button" type="button" data-route="home">Abbrechen</button>
            </div>
            <div id="response-conflict-actions" class="action-row" hidden style="margin-top:12px">
                <button id="keep-local-response" class="secondary-button" type="button">Vorhandene Antwort behalten</button>
                <button id="use-shared-response" class="danger-button" type="button">Geteilte Antwort verwenden</button>
            </div>
        </section>`;
    container.querySelector("#response-by").textContent = response.respondedBy;
    container.querySelector("#response-content").textContent = responseSummary(response);
    function save(useShared) {
        saveImportedResponse(response, useShared);
        context.toast("Antwort wird mit euren gemeinsamen Einladungen synchronisiert.");
        context.clearShare();
    }
    container.querySelector("#save-invite-response").addEventListener("click", () => {
        if (conflict) {
            container.querySelector("#response-conflict-actions").hidden = false;
            return;
        }
        save(false);
    });
    container.querySelector("#keep-local-response").addEventListener("click", () => save(false));
    container.querySelector("#use-shared-response").addEventListener("click", () => save(true));
    container.querySelector("#response-as-plan").addEventListener("click", () => {
        saveImportedResponse(response, false);
        context.clearShare(false);
        context.navigate("calendar", responseToPlanPrefill(response));
    });
}

export function renderInvitationShare(container, rawPayload, shareType, context) {
    if (shareType === "inviteResponse") {
        renderInvitationResponseShare(container, rawPayload, context);
        return;
    }
    let invitation;
    try {
        invitation = sanitizeInvitation(rawPayload);
    } catch (error) {
        context.renderShareError();
        return;
    }
    if (invitation.type === "OPEN_SELECTION") renderOpenInvitationShare(container, invitation, context);
    else renderConcreteInvitationShare(container, invitation, context);
}
