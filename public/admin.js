/* =====================================================
   TEMC ADMIN.JS
   MERGED WORKING VERSION
   Keeps JWT/Railway backend authentication and restores:
   stats, chart, filters, candidate cards, notes, ratings,
   interview fields, invite, reject, delete, CSV export.
===================================================== */

const API_BASE_URL = "https://event-production-111a.up.railway.app";

let allApplications = [];
let currentAdmin = null;
let applicationsChartInstance = null;

/* ---------------- ELEMENT HELPERS ---------------- */

function byId(id) {
    return document.getElementById(id);
}

function getLoginBox() {
    return byId("loginBox");
}

function getDashboardContent() {
    return byId("dashboardContent");
}

function getApplicationsContainer() {
    return byId("applications");
}

function getStatsContainer() {
    return byId("stats");
}

function getAdminInfoContainer() {
    return byId("adminInfo");
}

function getPermissionsContainer() {
    return byId("permissionsInfo");
}

/* ---------------- STORAGE HELPERS ---------------- */

function getToken() {
    return localStorage.getItem("temcAdminToken");
}

function setToken(token) {
    localStorage.setItem("temcAdminToken", token);
}

function clearToken() {
    localStorage.removeItem("temcAdminToken");
}

function setAdmin(admin) {
    localStorage.setItem("temcAdminUser", JSON.stringify(admin));
    localStorage.setItem("temcAdminLoggedIn", "true");
    localStorage.setItem("temcAdminEmail", admin.email || "");
    localStorage.setItem("temcAdminRole", admin.role || "");
}

function getAdmin() {
    try {
        return JSON.parse(localStorage.getItem("temcAdminUser"));
    } catch (error) {
        return null;
    }
}

function clearAdmin() {
    localStorage.removeItem("temcAdminUser");
    localStorage.removeItem("temcAdminLoggedIn");
    localStorage.removeItem("temcAdminEmail");
    localStorage.removeItem("temcAdminRole");
}

/* ---------------- ROLE HELPERS ---------------- */

function normaliseRole(role) {
    return String(role || "").toLowerCase();
}

function isOwner() {
    return currentAdmin && normaliseRole(currentAdmin.role) === "owner";
}

function isRecruiter() {
    return currentAdmin && normaliseRole(currentAdmin.role) === "recruiter";
}

function isViewer() {
    return currentAdmin && normaliseRole(currentAdmin.role) === "viewer";
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

function roleClass(role) {
    const cleanRole = normaliseRole(role);

    if (cleanRole === "owner") return "role-owner";
    if (cleanRole === "recruiter") return "role-recruiter";
    return "role-viewer";
}

function roleLabel(role) {
    return String(role || "viewer").toUpperCase();
}

function permissionsForRole(role) {
    const cleanRole = normaliseRole(role);

    if (cleanRole === "owner") {
        return [
            "Full dashboard access",
            "Manage recruiters",
            "Delete candidates",
            "Export reports"
        ];
    }

    if (cleanRole === "recruiter") {
        return [
            "Review applications",
            "Invite candidates",
            "Update notes"
        ];
    }

    return [
        "View dashboard only"
    ];
}

/* ---------------- SAFE FETCH ---------------- */

async function fetchJSON(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const text = await response.text();

    let data = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch (error) {
        throw new Error(`Server returned invalid JSON: ${text.slice(0, 180)}`);
    }

    if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
}

function authHeaders(extraHeaders = {}) {
    const token = getToken();

    return {
        ...extraHeaders,
        Authorization: `Bearer ${token}`
    };
}

/* ---------------- DISPLAY HELPERS ---------------- */

function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHTML(value);
}

function showToast(message, type = "info") {
    const toastContainer = byId("toastContainer");

    if (!toastContainer) {
        console.log(`${type.toUpperCase()}: ${message}`);
        return;
    }

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

    let date;

    if (value._seconds) {
        date = new Date(value._seconds * 1000);
    } else if (value.seconds) {
        date = new Date(value.seconds * 1000);
    } else {
        date = new Date(value);
    }

    return isNaN(date.getTime()) ? "Not set" : date.toLocaleString("en-GB");
}

function findApplication(id) {
    return allApplications.find(app => String(app.id) === String(id));
}

function normaliseStatus(status) {
    const value = String(status || "New").toLowerCase();

    if (value.includes("review")) return "Reviewed";
    if (value.includes("interview") || value.includes("invited")) return "Interview Stage";
    if (value.includes("reject")) return "Rejected";
    if (value.includes("hire")) return "Hired";

    return "New";
}

/* ---------------- LOGIN ---------------- */

async function loginAdmin() {
    const emailInput = byId("adminEmail");
    const passwordInput = byId("adminPassword");
    const loginMessage = byId("loginMessage");

    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";

    if (!email || !password) {
        if (loginMessage) {
            loginMessage.textContent = "Please enter admin email and password.";
            loginMessage.className = "error-message";
        }
        return;
    }

    if (loginMessage) {
        loginMessage.textContent = "Logging in...";
        loginMessage.className = "";
    }

    try {
        const result = await fetchJSON("/api/admin/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        if (!result.success || !result.token || !result.admin) {
            throw new Error(result.message || "Backend login failed.");
        }

        setToken(result.token);
        currentAdmin = result.admin;
        setAdmin(currentAdmin);

        const loginBox = getLoginBox();
        const dashboardContent = getDashboardContent();

        if (loginBox) loginBox.style.display = "none";
        if (dashboardContent) dashboardContent.style.display = "block";

        renderAdminRoleInfo();

        if (loginMessage) {
            loginMessage.textContent = "";
            loginMessage.className = "";
        }

        await loadApplications();

    } catch (error) {
        console.error("Login error:", error);

        if (loginMessage) {
            loginMessage.textContent = error.message || "Login failed.";
            loginMessage.className = "error-message";
        }
    }
}

function logoutAdmin() {
    clearToken();
    clearAdmin();

    const loginBox = getLoginBox();
    const dashboardContent = getDashboardContent();

    if (dashboardContent) dashboardContent.style.display = "none";
    if (loginBox) loginBox.style.display = "block";

    const applicationsContainer = getApplicationsContainer();
    const statsContainer = getStatsContainer();

    if (applicationsContainer) applicationsContainer.innerHTML = "";
    if (statsContainer) statsContainer.innerHTML = "";

    currentAdmin = null;
    allApplications = [];
}

async function restoreSavedLogin() {
    const token = getToken();
    const savedAdmin = getAdmin();

    const loginBox = getLoginBox();
    const dashboardContent = getDashboardContent();

    if (!token || !savedAdmin) {
        if (loginBox) loginBox.style.display = "block";
        if (dashboardContent) dashboardContent.style.display = "none";
        return;
    }

    currentAdmin = savedAdmin;

    if (loginBox) loginBox.style.display = "none";
    if (dashboardContent) dashboardContent.style.display = "block";

    renderAdminRoleInfo();
    await loadApplications();
}

function renderAdminRoleInfo() {
    const adminInfo = getAdminInfoContainer();
    const permissionsInfo = getPermissionsContainer();

    if (!currentAdmin) return;

    const adminEmail = currentAdmin.email || "Admin";
    const adminRole = currentAdmin.role || "viewer";

    if (adminInfo) {
        adminInfo.innerHTML = `
            <strong>Email:</strong> ${escapeHTML(adminEmail)}
            <span class="role-badge ${roleClass(adminRole)}">
                ${escapeHTML(roleLabel(adminRole))}
            </span>
        `;
    }

    if (permissionsInfo) {
        const permissions = permissionsForRole(adminRole);

        permissionsInfo.innerHTML = `
            <h3>Permissions</h3>
            <ul>
                ${permissions.map(permission => `<li>${escapeHTML(permission)}</li>`).join("")}
            </ul>
        `;
    }

    const exportCsvBtn = byId("exportCsvBtn");
    if (exportCsvBtn) {
        exportCsvBtn.style.display = canExport() ? "inline-block" : "none";
    }
}

/* ---------------- LOAD APPLICATIONS ---------------- */

async function loadApplications() {
    const applicationsContainer = getApplicationsContainer();

    if (!getToken()) {
        const loginBox = getLoginBox();
        const dashboardContent = getDashboardContent();

        if (loginBox) loginBox.style.display = "block";
        if (dashboardContent) dashboardContent.style.display = "none";
        return;
    }

    if (applicationsContainer) {
        applicationsContainer.innerHTML = "<p>Loading applications...</p>";
    }

    try {
        const result = await fetchJSON("/api/admin/applications", {
            method: "GET",
            headers: authHeaders()
        });

        allApplications = result.applications || [];

        renderStats();
        renderFilters();
        applyFilters();
        renderApplicationsChart(allApplications);

    } catch (error) {
        console.error("Load applications error:", error);

        if (applicationsContainer) {
            applicationsContainer.innerHTML = `
                <p class="error-message">${escapeHTML(error.message || "Failed to load applications.")}</p>
            `;
        }
    }
}

/* ---------------- STATS + CHART ---------------- */

function renderStats() {
    const statsContainer = getStatsContainer();
    if (!statsContainer) return;

    const total = allApplications.length;
    const newCount = allApplications.filter(app => normaliseStatus(app.status) === "New").length;
    const reviewedCount = allApplications.filter(app => normaliseStatus(app.status) === "Reviewed").length;
    const interviewCount = allApplications.filter(app => normaliseStatus(app.status) === "Interview Stage").length;
    const rejectedCount = allApplications.filter(app => normaliseStatus(app.status) === "Rejected").length;
    const hiredCount = allApplications.filter(app => normaliseStatus(app.status) === "Hired").length;

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
}

function renderApplicationsChart(applications = []) {
    const canvas = byId("applicationsChart");

    if (!canvas || typeof Chart === "undefined") return;

    const counts = {
        new: 0,
        reviewed: 0,
        interview: 0,
        rejected: 0,
        hired: 0
    };

    applications.forEach(app => {
        const status = normaliseStatus(app.status);

        if (status === "Reviewed") counts.reviewed++;
        else if (status === "Interview Stage") counts.interview++;
        else if (status === "Rejected") counts.rejected++;
        else if (status === "Hired") counts.hired++;
        else counts.new++;
    });

    if (applicationsChartInstance) {
        applicationsChartInstance.destroy();
    }

    applicationsChartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels: ["New", "Reviewed", "Interview Stage", "Rejected", "Hired"],
            datasets: [{
                label: "Candidates",
                data: [
                    counts.new,
                    counts.reviewed,
                    counts.interview,
                    counts.rejected,
                    counts.hired
                ],
                backgroundColor: [
                    "#00d9ff",
                    "#ffc400",
                    "#9c27b0",
                    "#cf352b",
                    "#3fa34d"
                ],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#ffffff"
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#ffffff"
                    },
                    grid: {
                        color: "rgba(255,255,255,0.08)"
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#ffffff",
                        stepSize: 1,
                        precision: 0
                    },
                    grid: {
                        color: "rgba(255,255,255,0.12)"
                    }
                }
            }
        }
    });
}

/* ---------------- FILTERS ---------------- */

function renderFilters() {
    const applicationsContainer = getApplicationsContainer();
    if (!applicationsContainer) return;

    let filterBox = byId("filterBox");

    if (!filterBox) {
        filterBox = document.createElement("div");
        filterBox.id = "filterBox";
        filterBox.className = "application-card";

        applicationsContainer.parentNode.insertBefore(filterBox, applicationsContainer);
    }

    const positions = [
        ...new Set(
            allApplications
                .map(app => app.position)
                .filter(Boolean)
        )
    ].sort();

    filterBox.innerHTML = `
        <h2>Search &amp; Filters</h2>

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
                <option value="${escapeAttribute(position)}">${escapeHTML(position)}</option>
            `).join("")}
        </select>

        <button type="button" onclick="clearFilters()">Clear Filters</button>

        <p id="filterCount" style="font-weight:bold;color:#ff9900;"></p>
    `;
}

function applyFilters() {
    const searchInput = byId("searchInput");
    const statusFilter = byId("statusFilter");
    const ratingFilter = byId("ratingFilter");
    const positionFilter = byId("positionFilter");
    const filterCount = byId("filterCount");

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
            ${app.message || ""}
        `.toLowerCase();

        const matchesSearch =
            !searchValue || searchableText.includes(searchValue);

        const matchesStatus =
            !statusValue || app.status === statusValue;

        const matchesRating =
            ratingValue === "" || Number(app.rating || 0) === Number(ratingValue);

        const matchesPosition =
            !positionValue || app.position === positionValue;

        return matchesSearch && matchesStatus && matchesRating && matchesPosition;
    });

    if (filterCount) {
        filterCount.textContent =
            `Showing ${filteredApplications.length} of ${allApplications.length} applications`;
    }

    renderApplications(filteredApplications);
}

function clearFilters() {
    const searchInput = byId("searchInput");
    const statusFilter = byId("statusFilter");
    const ratingFilter = byId("ratingFilter");
    const positionFilter = byId("positionFilter");

    if (searchInput) searchInput.value = "";
    if (statusFilter) statusFilter.value = "";
    if (ratingFilter) ratingFilter.value = "";
    if (positionFilter) positionFilter.value = "";

    applyFilters();
}

/* ---------------- RENDER APPLICATIONS ---------------- */

function renderApplications(applications) {
    const applicationsContainer = getApplicationsContainer();
    if (!applicationsContainer) return;

    if (!applications.length) {
        applicationsContainer.innerHTML = "<p>No applications found.</p>";
        return;
    }

    applicationsContainer.innerHTML = applications.map(app => {
        const id = escapeAttribute(app.id || "");
        const status = app.status || "New";
        const rating = Number(app.rating || 0);

        return `
            <div class="application-card">
                <h2>${escapeHTML(app.fullName || app.name || "Unnamed Candidate")}</h2>

                <div class="hero-image-placeholder" style="min-height:180px;font-size:1.2rem;margin:20px 0;">
                    Candidate Photograph Placeholder
                </div>

                <div class="text-placeholder">
                    Add recruiter observations, candidate summary notes,
                    assessment information and interview highlights here.
                </div>

                <p><strong>Email:</strong> ${escapeHTML(app.email || "N/A")}</p>
                <p><strong>Phone:</strong> ${escapeHTML(app.phone || "N/A")}</p>
                <p><strong>Position:</strong> ${escapeHTML(app.position || "N/A")}</p>
                <p><strong>About:</strong> ${escapeHTML(app.about || app.message || "N/A")}</p>
                <p><strong>Status:</strong> ${escapeHTML(status)}</p>
                <p><strong>Rating:</strong> ${escapeHTML(rating)} / 5</p>
                <p><strong>Applied:</strong> ${escapeHTML(formatDate(app.createdAt))}</p>

                ${
                    app.cvUrl
                        ? `<p><a href="${escapeAttribute(app.cvUrl)}" target="_blank">View CV</a></p>`
                        : `<p>No CV uploaded</p>`
                }

                <label>Status</label>
                <select id="status-${id}" ${!canEdit() ? "disabled" : ""}>
                    <option value="New" ${status === "New" ? "selected" : ""}>New</option>
                    <option value="Reviewed" ${status === "Reviewed" ? "selected" : ""}>Reviewed</option>
                    <option value="To Be Interviewed" ${status === "To Be Interviewed" ? "selected" : ""}>To Be Interviewed</option>
                    <option value="Interview Invited" ${status === "Interview Invited" ? "selected" : ""}>Interview Invited</option>
                    <option value="Rejected" ${status === "Rejected" ? "selected" : ""}>Rejected</option>
                    <option value="Hired" ${status === "Hired" ? "selected" : ""}>Hired</option>
                </select>

                <label>Rating</label>
                <select id="rating-${id}" ${!canEdit() ? "disabled" : ""}>
                    ${[0, 1, 2, 3, 4, 5].map(num => `
                        <option value="${num}" ${rating === num ? "selected" : ""}>${num}</option>
                    `).join("")}
                </select>

                <label>Notes</label>
                <textarea id="notes-${id}" ${!canEdit() ? "readonly" : ""}>${escapeHTML(app.notes || "")}</textarea>

                <label>Interview Date</label>
                <input type="date" id="interviewDate-${id}" value="${escapeAttribute(app.interviewDate || "")}" ${!canEdit() ? "disabled" : ""}>

                <label>Interview Time</label>
                <input type="time" id="interviewTime-${id}" value="${escapeAttribute(app.interviewTime || "")}" ${!canEdit() ? "disabled" : ""}>

                <div class="candidate-actions">
                    ${canEdit() ? `<button type="button" class="save-btn" onclick="saveApplication('${id}')">Save Updates</button>` : ""}
                    ${canEdit() ? `<button type="button" class="reject-btn" onclick="setRejected('${id}')">Reject Candidate</button>` : ""}
                    ${canInvite() ? `<button type="button" class="invite-btn" onclick="openInterviewTemplate('${id}')">Invite to Interview</button>` : ""}
                    ${canDelete() ? `<button type="button" class="delete-btn" onclick="deleteApplication('${id}')">Delete Candidate</button>` : ""}
                </div>
            </div>
        `;
    }).join("");
}

/* ---------------- SAVE / INVITE / DELETE ---------------- */

function setRejected(id) {
    const statusSelect = byId(`status-${id}`);

    if (statusSelect) {
        statusSelect.value = "Rejected";
    }

    saveApplication(id);
}

async function saveApplication(id) {
    if (!canEdit()) return showToast("Permission denied.", "error");

    const statusField = byId(`status-${id}`);
    const ratingField = byId(`rating-${id}`);
    const notesField = byId(`notes-${id}`);
    const dateField = byId(`interviewDate-${id}`);
    const timeField = byId(`interviewTime-${id}`);

    try {
        await fetchJSON(`/api/admin/applications/${id}`, {
            method: "PATCH",
            headers: authHeaders({
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({
                status: statusField ? statusField.value : "New",
                rating: ratingField ? Number(ratingField.value) : 0,
                notes: notesField ? notesField.value : "",
                interviewDate: dateField ? dateField.value : "",
                interviewTime: timeField ? timeField.value : ""
            })
        });

        showToast("Application updated successfully.", "success");
        await loadApplications();

    } catch (error) {
        console.error("Save error:", error);
        showToast(error.message || "Failed to save.", "error");
    }
}

async function openInterviewTemplate(id) {
    if (!canInvite()) return showToast("Permission denied.", "error");

    const app = findApplication(id);
    const dateInput = byId(`interviewDate-${id}`);
    const timeInput = byId(`interviewTime-${id}`);
    const statusSelect = byId(`status-${id}`);

    const interviewDate = dateInput ? dateInput.value : "";
    const interviewTime = timeInput ? timeInput.value : "";

    if (statusSelect) {
        statusSelect.value = "Interview Invited";
    }

    const confirmed = confirm(
        `Mark ${app?.fullName || "this candidate"} as invited to interview?`
    );

    if (!confirmed) return;

    try {
        await fetchJSON(`/api/admin/applications/${id}/invite`, {
            method: "POST",
            headers: authHeaders({
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({
                interviewDate,
                interviewTime
            })
        });

        showToast("Interview invitation updated successfully.", "success");
        await loadApplications();

    } catch (error) {
        console.error("Invite error:", error);
        showToast(error.message || "Failed to send invitation.", "error");
    }
}

async function deleteApplication(id) {
    if (!canDelete()) return showToast("Only owners can delete candidates.", "error");
    if (!confirm("Delete this candidate?")) return;

    try {
        await fetchJSON(`/api/admin/applications/${id}`, {
            method: "DELETE",
            headers: authHeaders()
        });

        showToast("Candidate deleted.", "success");
        await loadApplications();

    } catch (error) {
        console.error("Delete error:", error);
        showToast(error.message || "Failed to delete.", "error");
    }
}

/* ---------------- CSV EXPORT ---------------- */

function exportCSV() {
    if (!canExport()) return showToast("Permission denied.", "error");

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
        "Notes",
        "Interview Date",
        "Interview Time",
        "CV URL"
    ];

    const rows = allApplications.map(app => [
        app.fullName || app.name || "",
        app.email || "",
        app.phone || "",
        app.position || "",
        app.status || "",
        app.rating || "",
        app.notes || "",
        app.interviewDate || "",
        app.interviewTime || "",
        app.cvUrl || ""
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
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
    const loginBtn = byId("loginBtn");
    const logoutBtn = byId("logoutBtn");
    const exportCsvBtn = byId("exportCsvBtn");
    const emailInput = byId("adminEmail");
    const passwordInput = byId("adminPassword");

    if (loginBtn) loginBtn.addEventListener("click", loginAdmin);
    if (logoutBtn) logoutBtn.addEventListener("click", logoutAdmin);
    if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCSV);

    [emailInput, passwordInput].forEach(input => {
        if (input) {
            input.addEventListener("keydown", event => {
                if (event.key === "Enter") loginAdmin();
            });
        }
    });

    restoreSavedLogin();
});

/* Expose functions for inline onclick attributes */
window.loginAdmin = loginAdmin;
window.logoutAdmin = logoutAdmin;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.saveApplication = saveApplication;
window.setRejected = setRejected;
window.openInterviewTemplate = openInterviewTemplate;
window.deleteApplication = deleteApplication;
window.exportCSV = exportCSV;
