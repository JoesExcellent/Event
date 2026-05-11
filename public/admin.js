/* =====================================================
   TEMC RECRUITMENT ADMIN DASHBOARD
===================================================== */

const API_BASE_URL = "";

let allApplications = [];
let currentAdmin = null;

/* ---------------- ELEMENTS ---------------- */

const loginBox = document.getElementById("loginBox");
const dashboardContent = document.getElementById("dashboardContent");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const loginMessage = document.getElementById("loginMessage");
const applicationsContainer = document.getElementById("applications");
const statsContainer = document.getElementById("stats");
const adminInfo = document.getElementById("adminInfo");

/* ---------------- TOKEN HELPERS ---------------- */

function getToken() {
    return localStorage.getItem("adminToken");
}

function setToken(token) {
    localStorage.setItem("adminToken", token);
}

function clearToken() {
    localStorage.removeItem("adminToken");
}

function setAdmin(admin) {
    localStorage.setItem("adminUser", JSON.stringify(admin));
}

function getAdmin() {
    try {
        return JSON.parse(localStorage.getItem("adminUser"));
    } catch {
        return null;
    }
}

function clearAdmin() {
    localStorage.removeItem("adminUser");
}

/* ---------------- ROLE HELPERS ---------------- */

function isOwner() {
    return currentAdmin?.role === "owner";
}

function isRecruiter() {
    return currentAdmin?.role === "recruiter";
}

function isViewer() {
    return currentAdmin?.role === "viewer";
}

function canEdit() {
    return isOwner() || isRecruiter();
}

function canDelete() {
    return isOwner();
}

function canExport() {
    return isOwner() || isRecruiter();
}

function canInvite() {
    return isOwner() || isRecruiter();
}

/* ---------------- SAFE FETCH ---------------- */

async function fetchJSON(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch (error) {
        throw new Error(`Server returned invalid JSON.`);
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

/* ---------------- HELPERS ---------------- */

function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showToast(message, type = "info") {
    const toastContainer = document.getElementById("toastContainer");

    if (!toastContainer) return;

    const toast = document.createElement("div");

    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

function formatDate(value) {
    if (!value) return "Not set";

    const date = value._seconds
        ? new Date(value._seconds * 1000)
        : new Date(value);

    return isNaN(date.getTime())
        ? "Not set"
        : date.toLocaleString("en-GB");
}

function findApplication(id) {
    return allApplications.find(app => app.id === id);
}

/* ---------------- LOGIN ---------------- */

async function loginAdmin() {
    const emailInput = document.getElementById("adminEmail");
    const passwordInput = document.getElementById("adminPassword");

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        loginMessage.textContent = "Please enter admin email and password.";
        return;
    }

    loginMessage.textContent = "Logging in...";

    try {
        const result = await fetchJSON("/api/admin/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        if (!result.success || !result.token) {
            loginMessage.textContent = result.message || "Invalid login details.";
            return;
        }

        setToken(result.token);

        currentAdmin = result.admin || null;

        setAdmin(currentAdmin);

        loginBox.style.display = "none";
        dashboardContent.style.display = "block";

        renderAdminInfo();

        loginMessage.textContent = "";

        await loadApplications();

    } catch (error) {
        console.error("Login error:", error);

        loginMessage.textContent =
            error.message || "Login failed.";
    }
}

/* ---------------- LOGOUT ---------------- */

function logoutAdmin() {
    clearToken();
    clearAdmin();

    currentAdmin = null;
    allApplications = [];

    loginBox.style.display = "block";
    dashboardContent.style.display = "none";

    adminInfo.innerHTML = "";
    statsContainer.innerHTML = "";
    applicationsContainer.innerHTML = "";

    loginMessage.textContent = "Logged out.";
}

/* ---------------- RESTORE LOGIN ---------------- */

async function restoreSavedLogin() {
    const token = getToken();

    if (!token) {
        loginBox.style.display = "block";
        dashboardContent.style.display = "none";
        return;
    }

    currentAdmin = getAdmin();

    loginBox.style.display = "none";
    dashboardContent.style.display = "block";

    renderAdminInfo();

    await loadApplications();
}

/* ---------------- ADMIN INFO ---------------- */

function renderAdminInfo() {
    if (!currentAdmin) return;

    adminInfo.innerHTML = `
        <div class="application-card">
            <h2>Admin Information</h2>

            <p><strong>Name:</strong> ${escapeHTML(currentAdmin.name || "Unknown")}</p>

            <p><strong>Email:</strong> ${escapeHTML(currentAdmin.email || "")}</p>

            <p><strong>Role:</strong>
                <span style="color:#ff9900;text-transform:uppercase;">
                    ${escapeHTML(currentAdmin.role || "viewer")}
                </span>
            </p>
        </div>
    `;

    if (!canExport() && exportCsvBtn) {
        exportCsvBtn.style.display = "none";
    } else if (exportCsvBtn) {
        exportCsvBtn.style.display = "inline-block";
    }
}

/* ---------------- LOAD APPLICATIONS ---------------- */

async function loadApplications() {
    const token = getToken();

    if (!token) {
        loginBox.style.display = "block";
        dashboardContent.style.display = "none";
        return;
    }

    applicationsContainer.innerHTML =
        "<p>Loading applications...</p>";

    try {
        const result = await fetchJSON("/api/admin/applications", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        allApplications = result.applications || [];

        renderStats();
        renderApplications(allApplications);

    } catch (error) {
        console.error("Load applications error:", error);

        applicationsContainer.innerHTML = `
            <p class="error-message">
                ${escapeHTML(error.message)}
            </p>
        `;
    }
}

/* ---------------- STATS ---------------- */

function renderStats() {
    const total = allApplications.length;

    const newCount = allApplications.filter(
        app => app.status === "New"
    ).length;

    const reviewedCount = allApplications.filter(
        app => app.status === "Reviewed"
    ).length;

    const interviewCount = allApplications.filter(
        app =>
            app.status === "To Be Interviewed" ||
            app.status === "Interview Invited"
    ).length;

    const hiredCount = allApplications.filter(
        app => app.status === "Hired"
    ).length;

    statsContainer.innerHTML = `
        <div class="stats-grid">

            <div class="stat-card">
                <h3>Total Applications</h3>
                <p>${total}</p>
            </div>

            <div class="stat-card">
                <h3>New</h3>
                <p>${newCount}</p>
            </div>

            <div class="stat-card">
                <h3>Reviewed</h3>
                <p>${reviewedCount}</p>
            </div>

            <div class="stat-card">
                <h3>Interview Stage</h3>
                <p>${interviewCount}</p>
            </div>

            <div class="stat-card">
                <h3>Hired</h3>
                <p>${hiredCount}</p>
            </div>

        </div>
    `;
}

/* ---------------- RENDER APPLICATIONS ---------------- */

function renderApplications(applications) {

    if (!applications.length) {
        applicationsContainer.innerHTML =
            "<p>No applications found.</p>";
        return;
    }

    applicationsContainer.innerHTML = applications.map(app => {

        const id = escapeHTML(app.id);

        return `
            <div class="application-card">

                <h2>${escapeHTML(app.fullName || "Unnamed Candidate")}</h2>

                <div class="card-image-placeholder">
                    Candidate Photograph Placeholder
                </div>

                <div class="text-placeholder">
                    Add recruiter observations,
                    candidate summary notes,
                    assessment information and
                    interview highlights here.
                </div>

                <p><strong>Email:</strong> ${escapeHTML(app.email)}</p>

                <p><strong>Phone:</strong> ${escapeHTML(app.phone)}</p>

                <p><strong>Position:</strong> ${escapeHTML(app.position)}</p>

                <p><strong>About:</strong> ${escapeHTML(app.about)}</p>

                <p><strong>Status:</strong> ${escapeHTML(app.status || "New")}</p>

                <p><strong>Rating:</strong> ${escapeHTML(app.rating || 0)} / 5</p>

                <p><strong>Applied:</strong> ${formatDate(app.createdAt)}</p>

                ${
                    app.cvUrl
                        ? `<p>
                            <a href="${escapeHTML(app.cvUrl)}" target="_blank">
                                View CV
                            </a>
                           </p>`
                        : `<p>No CV uploaded</p>`
                }

                <label>Status</label>

                <select id="status-${id}" ${!canEdit() ? "disabled" : ""}>

                    <option value="New" ${app.status === "New" ? "selected" : ""}>New</option>

                    <option value="Reviewed" ${app.status === "Reviewed" ? "selected" : ""}>Reviewed</option>

                    <option value="To Be Interviewed" ${app.status === "To Be Interviewed" ? "selected" : ""}>To Be Interviewed</option>

                    <option value="Interview Invited" ${app.status === "Interview Invited" ? "selected" : ""}>Interview Invited</option>

                    <option value="Rejected" ${app.status === "Rejected" ? "selected" : ""}>Rejected</option>

                    <option value="Hired" ${app.status === "Hired" ? "selected" : ""}>Hired</option>

                </select>

                <label>Rating</label>

                <select id="rating-${id}" ${!canEdit() ? "disabled" : ""}>

                    ${[0,1,2,3,4,5].map(num => `
                        <option
                            value="${num}"
                            ${Number(app.rating || 0) === num ? "selected" : ""}
                        >
                            ${num}
                        </option>
                    `).join("")}

                </select>

                <label>Notes</label>

                <textarea
                    id="notes-${id}"
                    ${!canEdit() ? "readonly" : ""}
                >${escapeHTML(app.notes || "")}</textarea>

                <label>Interview Date</label>

                <input
                    type="date"
                    id="interviewDate-${id}"
                    value="${escapeHTML(app.interviewDate || "")}"
                    ${!canEdit() ? "disabled" : ""}
                >

                <label>Interview Time</label>

                <input
                    type="time"
                    id="interviewTime-${id}"
                    value="${escapeHTML(app.interviewTime || "")}"
                    ${!canEdit() ? "disabled" : ""}
                >

                ${
                    canEdit()
                    ? `
                        <button
                            type="button"
                            onclick="saveApplication('${id}')"
                        >
                            Save Updates
                        </button>
                    `
                    : ""
                }

                ${
                    canInvite()
                    ? `
                        <button
                            type="button"
                            onclick="openInterviewTemplate('${id}')"
                        >
                            Invite to Interview
                        </button>
                    `
                    : ""
                }

                ${
                    canDelete()
                    ? `
                        <button
                            type="button"
                            onclick="deleteApplication('${id}')"
                        >
                            Delete Candidate
                        </button>
                    `
                    : ""
                }

                <div
                    id="template-${id}"
                    style="display:none;margin-top:25px;"
                >

                    <h3>Interview Invitation Template</h3>

                    <textarea
                        id="emailTemplate-${id}"
                        style="min-height:270px;"
                    ></textarea>

                    <button
                        type="button"
                        onclick="copyInterviewTemplate('${id}')"
                    >
                        Copy Template
                    </button>

                    <button
                        type="button"
                        onclick="openEmailClient('${id}')"
                    >
                        Open Email
                    </button>

                </div>

            </div>
        `;

    }).join("");
}

/* ---------------- SAVE APPLICATION ---------------- */

async function saveApplication(id) {

    if (!canEdit()) {
        showToast("Permission denied.", "error");
        return;
    }

    const token = getToken();

    try {

        const result = await fetchJSON(
            `/api/admin/applications/${id}`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify({
                    status: document.getElementById(`status-${id}`).value,
                    rating: Number(document.getElementById(`rating-${id}`).value),
                    notes: document.getElementById(`notes-${id}`).value,
                    interviewDate: document.getElementById(`interviewDate-${id}`).value,
                    interviewTime: document.getElementById(`interviewTime-${id}`).value
                })
            }
        );

        if (result.success) {
            showToast("Application updated successfully.", "success");
            await loadApplications();
        }

    } catch (error) {
        console.error(error);

        showToast(
            error.message || "Failed to save application.",
            "error"
        );
    }
}

/* ---------------- DELETE APPLICATION ---------------- */

async function deleteApplication(id) {

    if (!canDelete()) {
        showToast("Only owners can delete candidates.", "error");
        return;
    }

    if (!confirm("Delete this candidate?")) return;

    const token = getToken();

    try {

        const result = await fetchJSON(
            `/api/admin/applications/${id}`,
            {
                method: "DELETE",

                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (result.success) {
            showToast("Candidate deleted.", "success");
            await loadApplications();
        }

    } catch (error) {
        console.error(error);

        showToast(
            error.message || "Failed to delete candidate.",
            "error"
        );
    }
}

/* ---------------- INTERVIEW TEMPLATE ---------------- */

function openInterviewTemplate(id) {

    if (!canInvite()) {
        showToast("Permission denied.", "error");
        return;
    }

    const app = findApplication(id);

    if (!app) {
        showToast("Candidate not found.", "error");
        return;
    }

    const templateBox =
        document.getElementById(`template-${id}`);

    const templateArea =
        document.getElementById(`emailTemplate-${id}`);

    const interviewDate =
        document.getElementById(`interviewDate-${id}`).value ||
        "[INSERT INTERVIEW DATE]";

    const interviewTime =
        document.getElementById(`interviewTime-${id}`).value ||
        "[INSERT INTERVIEW TIME]";

    templateArea.value = `Subject: Invitation to Interview - ${app.position || "Your Application"}

Dear ${app.fullName || "Candidate"},

Thank you for applying for the role of ${app.position || "the advertised position"} with The Excellent Management Company.

We are pleased to invite you to attend an interview.

Interview details:

Date: ${interviewDate}
Time: ${interviewTime}
Location: [INSERT LOCATION]

We look forward to meeting you.

Kind regards,

The Excellent Management Company`;

    templateBox.style.display = "block";
}

async function copyInterviewTemplate(id) {

    const templateArea =
        document.getElementById(`emailTemplate-${id}`);

    try {

        await navigator.clipboard.writeText(
            templateArea.value
        );

        showToast("Template copied.", "success");

    } catch {
        showToast("Copy failed.", "error");
    }
}

function openEmailClient(id) {

    const app = findApplication(id);

    const templateArea =
        document.getElementById(`emailTemplate-${id}`);

    if (!app || !app.email) {
        showToast("Candidate email missing.", "error");
        return;
    }

    const subject = encodeURIComponent(
        `Invitation to Interview - ${app.position || "Application"}`
    );

    const body = encodeURIComponent(templateArea.value);

    window.open(
        `mailto:${app.email}?subject=${subject}&body=${body}`,
        "_blank"
    );
}

/* ---------------- EXPORT CSV ---------------- */

function exportCSV() {

    if (!canExport()) {
        showToast("Permission denied.", "error");
        return;
    }

    if (!allApplications.length) {
        showToast("No applications to export.", "info");
        return;
    }

    const headers = [
        "Full Name",
        "Email",
        "Phone",
        "Position",
        "Status",
        "Rating",
        "Notes"
    ];

    const rows = allApplications.map(app => [
        app.fullName || "",
        app.email || "",
        app.phone || "",
        app.position || "",
        app.status || "",
        app.rating || "",
        app.notes || ""
    ]);

    const csvContent = [headers, ...rows]
        .map(row =>
            row.map(value =>
                `"${String(value).replaceAll('"', '""')}"`
            ).join(",")
        )
        .join("\n");

    const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;"
    });

    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "temc-applications.csv";

    link.click();

    URL.revokeObjectURL(link.href);
}

/* ---------------- START ---------------- */

document.addEventListener("DOMContentLoaded", () => {

    if (loginBtn) {
        loginBtn.addEventListener("click", loginAdmin);
    }

    const passwordInput =
        document.getElementById("adminPassword");

    if (passwordInput) {
        passwordInput.addEventListener("keydown", event => {

            if (event.key === "Enter") {
                loginAdmin();
            }

        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logoutAdmin);
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", exportCSV);
    }

    restoreSavedLogin();

});
