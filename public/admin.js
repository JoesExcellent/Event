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
    } catch {
        throw new Error("Server returned invalid JSON.");
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

function getApplicationFormValues(id) {
    return {
        status: document.getElementById(`status-${id}`)?.value || "New",
        rating: Number(document.getElementById(`rating-${id}`)?.value || 0),
        notes: document.getElementById(`notes-${id}`)?.value || "",
        interviewDate: document.getElementById(`interviewDate-${id}`)?.value || "",
        interviewTime: document.getElementById(`interviewTime-${id}`)?.value || ""
    };
}

async function updateApplication(id, payload, successMessage = "Application updated successfully.") {
    if (!canEdit()) return showToast("Permission denied.", "error");

    const token = getToken();

    try {
        await fetchJSON(`/api/admin/applications/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        showToast(successMessage, "success");
        await loadApplications();

    } catch (error) {
        showToast(error.message || "Failed to update application.", "error");
    }
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
            body: JSON.stringify({ email, password })
        });

        setToken(result.token);
        currentAdmin = result.admin || null;
        setAdmin(currentAdmin);

        loginBox.style.display = "none";
        dashboardContent.style.display = "block";
        loginMessage.textContent = "";

        renderAdminInfo();
        await loadApplications();

    } catch (error) {
        console.error("Login error:", error);
        loginMessage.textContent = error.message || "Login failed.";
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

    if (exportCsvBtn) {
        exportCsvBtn.style.display = canExport() ? "inline-block" : "none";
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

    applicationsContainer.innerHTML = "<p>Loading applications...</p>";

    try {
        const result = await fetchJSON("/api/admin/applications", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        allApplications = result.applications || [];

        renderStats();
        renderFilters();
        applyFilters();

    } catch (error) {
        console.error("Load applications error:", error);

        applicationsContainer.innerHTML = `
            <p class="error-message">${escapeHTML(error.message)}</p>
        `;
    }
}

/* ---------------- STATS + ANALYTICS ---------------- */

function renderStats() {
    const total = allApplications.length;
    const newCount = allApplications.filter(app => (app.status || "New") === "New").length;
    const reviewedCount = allApplications.filter(app => app.status === "Reviewed").length;
    const interviewCount = allApplications.filter(app =>
        app.status === "To Be Interviewed" ||
        app.status === "Interview Invited"
    ).length;
    const rejectedCount = allApplications.filter(app => app.status === "Rejected").length;
    const hiredCount = allApplications.filter(app => app.status === "Hired").length;

    statsContainer.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><h3>Total Applications</h3><p>${total}</p></div>
            <div class="stat-card"><h3>New</h3><p>${newCount}</p></div>
            <div class="stat-card"><h3>Reviewed</h3><p>${reviewedCount}</p></div>
            <div class="stat-card"><h3>Interview Stage</h3><p>${interviewCount}</p></div>
            <div class="stat-card"><h3>Rejected</h3><p>${rejectedCount}</p></div>
            <div class="stat-card"><h3>Hired</h3><p>${hiredCount}</p></div>
        </div>
    `;

    if (typeof renderRecruitmentAnalytics === "function") {
        renderRecruitmentAnalytics(allApplications);
    }
}

/* ---------------- SEARCH + FILTERS ---------------- */

function renderFilters() {
    let filterBox = document.getElementById("filterBox");

    if (!filterBox) {
        filterBox = document.createElement("div");
        filterBox.id = "filterBox";
        filterBox.className = "application-card";

        applicationsContainer.parentNode.insertBefore(
            filterBox,
            applicationsContainer
        );
    }

    const positions = [
        ...new Set(
            allApplications
                .map(app => app.position)
                .filter(Boolean)
        )
    ].sort();

    filterBox.innerHTML = `
        <h2>Search & Filters</h2>

        <input
            type="text"
            id="searchInput"
            placeholder="Search by name, email, phone or position"
            oninput="applyFilters()"
        >

        <label>Status</label>
        <select id="statusFilter" onchange="applyFilters()">
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Reviewed">Reviewed</option>
            <option value="To Be Interviewed">To Be Interviewed</option>
            <option value="Interview Invited">Interview Invited</option>
            <option value="Rejected">Rejected</option>
            <option value="Hired">Hired</option>
        </select>

        <label>Rating</label>
        <select id="ratingFilter" onchange="applyFilters()">
            <option value="">All Ratings</option>
            <option value="0">0 Stars</option>
            <option value="1">1 Star</option>
            <option value="2">2 Stars</option>
            <option value="3">3 Stars</option>
            <option value="4">4 Stars</option>
            <option value="5">5 Stars</option>
        </select>

        <label>Position</label>
        <select id="positionFilter" onchange="applyFilters()">
            <option value="">All Positions</option>
            ${positions.map(position => `
                <option value="${escapeHTML(position)}">
                    ${escapeHTML(position)}
                </option>
            `).join("")}
        </select>

        <button type="button" onclick="clearFilters()">Clear Filters</button>

        <p id="filterCount" style="font-weight:bold;color:#ff9900;"></p>
    `;
}

function applyFilters() {
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const ratingFilter = document.getElementById("ratingFilter");
    const positionFilter = document.getElementById("positionFilter");
    const filterCount = document.getElementById("filterCount");

    const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const statusValue = statusFilter ? statusFilter.value : "";
    const ratingValue = ratingFilter ? ratingFilter.value : "";
    const positionValue = positionFilter ? positionFilter.value : "";

    const filteredApplications = allApplications.filter(app => {
        const searchableText = `
            ${app.fullName || ""}
            ${app.email || ""}
            ${app.phone || ""}
            ${app.position || ""}
            ${app.about || ""}
        `.toLowerCase();

        const matchesSearch = !searchValue || searchableText.includes(searchValue);
        const matchesStatus = !statusValue || app.status === statusValue;
        const matchesRating = ratingValue === "" || Number(app.rating || 0) === Number(ratingValue);
        const matchesPosition = !positionValue || app.position === positionValue;

        return matchesSearch && matchesStatus && matchesRating && matchesPosition;
    });

    if (filterCount) {
        filterCount.textContent =
            `Showing ${filteredApplications.length} of ${allApplications.length} applications`;
    }

    renderApplications(filteredApplications);
}

function clearFilters() {
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const ratingFilter = document.getElementById("ratingFilter");
    const positionFilter = document.getElementById("positionFilter");

    if (searchInput) searchInput.value = "";
    if (statusFilter) statusFilter.value = "";
    if (ratingFilter) ratingFilter.value = "";
    if (positionFilter) positionFilter.value = "";

    applyFilters();
}

/* ---------------- RENDER APPLICATIONS ---------------- */

function renderApplications(applications) {
    if (!applications.length) {
        applicationsContainer.innerHTML = "<p>No applications found.</p>";
        return;
    }

    applicationsContainer.innerHTML = applications.map(app => {
        const id = escapeHTML(app.id);

        return `
            <div class="application-card">
                <h2>${escapeHTML(app.fullName || "Unnamed Candidate")}</h2>

                <div class="text-placeholder">
                    Recruiter observations, candidate summary notes,
                    assessment information and interview highlights can be recorded below.
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
                        ? `<p><a href="${escapeHTML(app.cvUrl)}" target="_blank" rel="noopener">View CV</a></p>`
                        : `<p>No CV uploaded</p>`
                }

                <label>Status</label>
                <select id="status-${id}" ${!canEdit() ? "disabled" : ""}>
                    <option value="New" ${(app.status || "New") === "New" ? "selected" : ""}>New</option>
                    <option value="Reviewed" ${app.status === "Reviewed" ? "selected" : ""}>Reviewed</option>
                    <option value="To Be Interviewed" ${app.status === "To Be Interviewed" ? "selected" : ""}>To Be Interviewed</option>
                    <option value="Interview Invited" ${app.status === "Interview Invited" ? "selected" : ""}>Interview Invited</option>
                    <option value="Rejected" ${app.status === "Rejected" ? "selected" : ""}>Rejected</option>
                    <option value="Hired" ${app.status === "Hired" ? "selected" : ""}>Hired</option>
                </select>

                <label>Rating</label>
                <select id="rating-${id}" ${!canEdit() ? "disabled" : ""}>
                    ${[0,1,2,3,4,5].map(num => `
                        <option value="${num}" ${Number(app.rating || 0) === num ? "selected" : ""}>
                            ${num}
                        </option>
                    `).join("")}
                </select>

                <label>Notes</label>
                <textarea id="notes-${id}" ${!canEdit() ? "readonly" : ""}>${escapeHTML(app.notes || "")}</textarea>

                <label>Interview Date</label>
                <input type="date" id="interviewDate-${id}" value="${escapeHTML(app.interviewDate || "")}" ${!canEdit() ? "disabled" : ""}>

                <label>Interview Time</label>
                <input type="time" id="interviewTime-${id}" value="${escapeHTML(app.interviewTime || "")}" ${!canEdit() ? "disabled" : ""}>

                ${canEdit() ? `<button type="button" onclick="saveApplication('${id}')">Save Updates</button>` : ""}
                ${canEdit() ? `<button type="button" class="reject-btn" onclick="rejectApplication('${id}')">Reject Candidate</button>` : ""}
                ${canInvite() ? `<button type="button" onclick="openInterviewTemplate('${id}')">Invite to Interview</button>` : ""}
                ${canDelete() ? `<button type="button" onclick="deleteApplication('${id}')">Delete Candidate</button>` : ""}
            </div>
        `;
    }).join("");
}

/* ---------------- SAVE / REJECT / DELETE / EXPORT ---------------- */

async function saveApplication(id) {
    const payload = getApplicationFormValues(id);
    await updateApplication(id, payload, "Application updated successfully.");
}

async function rejectApplication(id) {
    if (!canEdit()) return showToast("Permission denied.", "error");

    const app = findApplication(id);
    const candidateName = app?.fullName || "this candidate";

    if (!confirm(`Reject ${candidateName}?`)) return;

    const payload = {
        ...getApplicationFormValues(id),
        status: "Rejected"
    };

    const statusSelect = document.getElementById(`status-${id}`);
    if (statusSelect) statusSelect.value = "Rejected";

    await updateApplication(id, payload, "Candidate marked as rejected.");
}

async function deleteApplication(id) {
    if (!canDelete()) return showToast("Only owners can delete candidates.", "error");
    if (!confirm("Delete this candidate?")) return;

    const token = getToken();

    try {
        await fetchJSON(`/api/admin/applications/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        showToast("Candidate deleted.", "success");
        await loadApplications();

    } catch (error) {
        showToast(error.message || "Failed to delete.", "error");
    }
}

function exportCSV() {
    if (!canExport()) return showToast("Permission denied.", "error");

    const csvContent = [
        ["Full Name", "Email", "Phone", "Position", "Status", "Rating"],
        ...allApplications.map(app => [
            app.fullName || "",
            app.email || "",
            app.phone || "",
            app.position || "",
            app.status || "",
            app.rating || ""
        ])
    ].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "temc-applications.csv";
    link.click();

    URL.revokeObjectURL(link.href);
}

/* ---------------- INTERVIEW TEMPLATE FALLBACK ---------------- */

function openInterviewTemplate(id) {
    const app = findApplication(id);

    if (!app) {
        showToast("Candidate not found.", "error");
        return;
    }

    const date = document.getElementById(`interviewDate-${id}`)?.value || "[interview date]";
    const time = document.getElementById(`interviewTime-${id}`)?.value || "[interview time]";

    const message = `Dear ${app.fullName || "Candidate"},\n\nWe are pleased to invite you to interview for the ${app.position || "role"} position.\n\nInterview date: ${date}\nInterview time: ${time}\n\nKind regards,\nJoe's Excellent Event & Management`;

    navigator.clipboard?.writeText(message)
        .then(() => showToast("Interview invitation copied to clipboard.", "success"))
        .catch(() => alert(message));
}

/* ---------------- START ---------------- */

document.addEventListener("DOMContentLoaded", () => {
    if (loginBtn) loginBtn.addEventListener("click", loginAdmin);
    if (logoutBtn) logoutBtn.addEventListener("click", logoutAdmin);
    if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCSV);

    const passwordInput = document.getElementById("adminPassword");

    if (passwordInput) {
        passwordInput.addEventListener("keydown", event => {
            if (event.key === "Enter") loginAdmin();
        });
    }

    restoreSavedLogin();
});
