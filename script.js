const dateForm = document.querySelector("#date-form");

if (dateForm) {
    const dateInput = document.querySelector("#date");
    const delegateInput = document.querySelector("#delegate");
    const errorMessage = document.querySelector("#date-error");

    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0];

    dateInput.min = localToday;

    delegateInput.addEventListener("change", function () {
        if (delegateInput.checked) {
            dateInput.value = "";
            dateInput.disabled = true;
        } else {
            dateInput.disabled = false;
        }

        errorMessage.textContent = "";
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
            : dateInput.value;

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

    activityForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (selectedActivities.size === 0) {
            errorMessage.textContent = "Bitte wähle mindestens eine Aktivität aus.";
            return;
        }

        const dateChoice = localStorage.getItem("dateChoice") || "Keine Angabe";
        const timeChoice = localStorage.getItem("timeChoice") || "Keine Angabe";

        sendButton.disabled = true;
        sendButton.textContent = "Wird gesendet ...";
        errorMessage.textContent = "";

        const emailData = {
            _subject: "Antwort auf deine Einladung",
            Datum: dateChoice,
            Uhrzeit: timeChoice,
            Aktivitäten: Array.from(selectedActivities).join(", ")
        };

        try {
            /* Ersetze YOUR_EMAIL@example.com durch deine eigene E-Mail-Adresse. */
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
            sendButton.textContent = "Schicken";
        }
    });
}
