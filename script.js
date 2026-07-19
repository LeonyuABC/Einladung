const NO_SELECTION = "Keine Auswahl";

const dateForm = document.querySelector("#date-form");

if (dateForm) {
    const dateInput = document.querySelector("#date");
    const delegateInput = document.querySelector("#delegate");
    const datePreview = document.querySelector("#date-preview");
    const errorMessage = document.querySelector("#date-error");
    const skipDateButton = document.querySelector("#skip-date");

    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0];

    dateInput.min = localToday;

    function formatGermanDate(dateValue) {
        const date = new Date(dateValue + "T00:00:00");

        return date.toLocaleDateString("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    dateInput.addEventListener("change", function () {
        datePreview.textContent = dateInput.value
            ? formatGermanDate(dateInput.value)
            : "";
        errorMessage.textContent = "";
    });

    delegateInput.addEventListener("change", function () {
        if (delegateInput.checked) {
            dateInput.value = "";
            dateInput.disabled = true;
            datePreview.textContent = "";
        } else {
            dateInput.disabled = false;
        }

        errorMessage.textContent = "";
    });

    skipDateButton.addEventListener("click", function () {
        localStorage.setItem("dateChoice", NO_SELECTION);
        localStorage.setItem("timeChoice", NO_SELECTION);
        window.location.href = "seite3.html";
    });

    dateForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const selectedTime = document.querySelector('input[name="time"]:checked');

        if (!dateInput.value && !delegateInput.checked) {
            errorMessage.textContent = "Bitte wähle einen Tag aus oder überlass es mir.";
            return;
        }

        if (!selectedTime) {
            errorMessage.textContent = "Bitte wähle noch eine Uhrzeit aus.";
            return;
        }

        const dateChoice = delegateInput.checked
            ? "Überlass es mir"
            : formatGermanDate(dateInput.value);

        localStorage.setItem("dateChoice", dateChoice);
        localStorage.setItem("timeChoice", selectedTime.value);
        window.location.href = "seite3.html";
    });
}

const activityForm = document.querySelector("#activity-form");

if (activityForm) {
    const activityButtons = document.querySelectorAll(".activity-button");
    const errorMessage = document.querySelector("#activity-error");
    const sendButton = document.querySelector("#send-button");
    const skipActivitiesButton = document.querySelector("#skip-activities");
    const selectedActivities = new Set();

    activityButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            const activity = button.dataset.activity;

            if (selectedActivities.has(activity)) {
                selectedActivities.delete(activity);
                button.classList.remove("selected");
            } else {
                selectedActivities.add(activity);
                button.classList.add("selected");
            }

            errorMessage.textContent = "";
        });
    });

    async function sendInvitation(activities) {
        const dateChoice = localStorage.getItem("dateChoice") || NO_SELECTION;
        const timeChoice = localStorage.getItem("timeChoice") || NO_SELECTION;

        sendButton.disabled = true;
        skipActivitiesButton.disabled = true;
        sendButton.textContent = "Wird gesendet ...";
        errorMessage.textContent = "";

        const emailData = {
            _subject: "Antwort auf deine Einladung",
            Datum: dateChoice,
            Uhrzeit: timeChoice,
            Aktivitäten: activities
        };

        try {
            const response = await fetch(
                "https://formsubmit.co/ajax/yaoyuliu2005@163.com",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(emailData)
                }
            );

            if (!response.ok) {
                throw new Error("Die Nachricht konnte nicht gesendet werden.");
            }

            localStorage.removeItem("dateChoice");
            localStorage.removeItem("timeChoice");
            window.location.href = "seite4.html";
        } catch (error) {
            errorMessage.textContent = "Das Senden hat nicht geklappt. Bitte versuch es noch einmal.";
            sendButton.disabled = false;
            skipActivitiesButton.disabled = false;
            sendButton.textContent = "Schicken";
        }
    }

    activityForm.addEventListener("submit", function (event) {
        event.preventDefault();

        if (selectedActivities.size === 0) {
            errorMessage.textContent = "Bitte wähle mindestens eine Aktivität aus.";
            return;
        }

        sendInvitation(Array.from(selectedActivities).join(", "));
    });

    skipActivitiesButton.addEventListener("click", function () {
        sendInvitation(NO_SELECTION);
    });
}
