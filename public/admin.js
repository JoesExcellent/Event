document.addEventListener("DOMContentLoaded", () => {
    if (loginBtn) {
        loginBtn.addEventListener("click", loginAdmin);
    }

    const adminPasswordInput = document.getElementById("adminPassword");

    if (adminPasswordInput) {
        adminPasswordInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                loginAdmin();
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logoutAdmin);
    }

    restoreSavedLogin();
});
