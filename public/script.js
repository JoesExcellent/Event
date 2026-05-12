const form = document.getElementById("applicationForm");
const messageBox = document.getElementById("message");

const API_URL = window.location.origin;

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    messageBox.textContent = "Submitting application...";
    messageBox.style.color = "white";

    const formData = new FormData(form);

    try {
        const response = await fetch(`${API_URL}/api/apply`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.success) {
            messageBox.textContent = "Application submitted successfully.";
            messageBox.style.color = "#27ae60";
            form.reset();
        } else {
            messageBox.textContent = result.message || "Failed to submit application.";
            messageBox.style.color = "#ff4d4d";
        }
    } catch (error) {
        console.error("Submit error:", error);
        messageBox.textContent = "Server error. Please try again.";
        messageBox.style.color = "#ff4d4d";
    }
});