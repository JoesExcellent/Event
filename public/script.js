const applicationForm = document.getElementById("applicationForm");
const messageBox = document.getElementById("message");

function showMessage(message, type = "info") {
    if (!messageBox) return;
    messageBox.textContent = message;
    messageBox.style.color = type === "success" ? "#2ecc71" : type === "error" ? "#ff7675" : "#ffffff";
}

if (applicationForm) {
    applicationForm.addEventListener("submit", async event => {
        event.preventDefault();
        showMessage("Submitting your application...", "info");

        const formData = new FormData(applicationForm);
        const cv = formData.get("cv");

        if (!cv || !cv.name) {
            showMessage("Please upload your CV before submitting.", "error");
            return;
        }

        if (cv.size > 10 * 1024 * 1024) {
            showMessage("Your CV must be under 10MB.", "error");
            return;
        }

        try {
            const response = await fetch("/api/apply", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                showMessage(result.message || "Failed to submit application.", "error");
                return;
            }

            showMessage("Application submitted successfully.", "success");
            alert("Application submitted successfully");
            applicationForm.reset();
        } catch (error) {
            console.error("Application submit error:", error);
            showMessage("Server error. Please try again.", "error");
        }
    });
}
