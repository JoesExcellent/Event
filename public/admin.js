/* =====================================================
   JOE'S EXCELLENT EVENTS & MANAGEMENT - ADMIN.JS
   Full working admin dashboard JavaScript
   Correct backend routes:
   POST   /admin/login
   GET    /api/applications
   PATCH  /api/applications/:id
   DELETE /api/applications/:id
   POST   /api/applications/:id/invite
===================================================== */

const API_BASE_URL = "https://event-production-111a.up.railway.app";

let allApplications = [];
let currentApplications = [];
let currentAdmin = null;
let applicationsChartInstance = null;

/* =====================================================
   ELEMENT HELPERS
===================================================== */

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

/* =====================================================
   LOCAL STORAGE HELPERS
===================================================== */

function getToken() {
    return localStorage.getItem("temcAdminToken");
}

function setToken(token) {
    localStorage.setItem("temcAdminToken", token);
}

function clearToken() {
    localStorage.removeItem("temcAdminToken");
}

function setAdmin(adminUser) {
    localStorage.setItem("temcAdminUser", JSON.stringify(adminUser));
    localStorage.setItem("temcAdminLoggedIn", "true");
    localStorage.setItem("temcAdminEmail", adminUser.email || "");
    localStorage.setItem("temcAdminRole", adminUser.role || "");
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

/* =====================================================
   ROLE HELPERS
===================================================== */

function normaliseRole(role) {
    return String(role || "").toLowerCase();
}

function isAdmin() {
    const role = currentAdmin ? normaliseRole(currentAdmin.role) : "";
    return role === "admin" || role === "owner";
}

function isRecruiter() {
    return currentAdmin && normaliseRole(currentAdmin.role) === "recruiter";
}

function isViewer() {
    return currentAdmin && normaliseRole(currentAdmin.role) === "viewer";
}

function canEdit() {
    return isAdmin() || isRecruiter();
}

function canDelete() {
    return isAdmin() || isRecruiter();
}

function canExport() {
    return isAdmin() || isRecruiter();
}

function canInvite() {
    return isAdmin() || isRecruiter();
}

function roleClass(role) {
    const cleanRole = normaliseRole(role);

    if (cleanRole === "admin" || cleanRole === "owner") return "role-owner";
    if (cleanRole === "recruiter") return "role-recruiter";
    return "role-viewer";
}

function roleLabel(role) {
    return String(role || "viewer").toUpperCase();
}

function permissionsForRole(role) {
    const cleanRole = normaliseRole(role);

    if (cleanRole === "admin" || cleanRole === "owner") {
        return [
            "Full dashboard access",
            "Review applications",
            "Update candidate status",
            "Invite candidates to interview",
            "Save notes and ratings",
            "Delete candidates",
            "Export reports"
        ];
    }

    if (cleanRole === "recruiter") {
        return [
            "Review applications",
            "Update candidate status",
            "Invite candidates to interview",
            "Save notes and ratings",
            "Export reports"
        ];
    }

    return [
        "View dashboard only"
    ];
}

/* =====================================================
   FETCH HELPERS
===================================================== */

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

/* =====================================================
   DISPLAY HELPERS
===================================================== */

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

function normaliseStatus(status) {
    const value = String(status || "New").toLowerCase();

    if (value.includes("interview") || value.includes("invited")) return "Interview Stage";
    if (value.includes("review")) return "Reviewed";
    if (value.includes("reject")) return "Rejected";
    if (value.includes("hire") || value.includes("successful")) return "Hired";

    return "New";
}

function getCandidateName(app) {
    return app.fullName || app.name || "Unnamed Candidate";
}

function getCvLink(app) {
    return app.cvUrl || app.cv || "";
}

function findApplication(id) {
    return allApplications.find(app => String(app.id) === String(id));
}

/* =====================================================
   LOGIN / LOGOUT
===================================================== */

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
        const result = await fetchJSON("/admin/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        if (!result.success || !result.token) {
            throw new Error(result.message || "Login failed.");
        }

        const adminUser = {
            email,
            role: result.role || "admin"
        };

        setToken(result.token);
        setAdmin(adminUser);
        currentAdmin = adminUser;

        const loginBox = getLoginBox();
        const dashboardContent = getDashboardContent();

        if (loginBox) loginBox.style.display = "none";
        if (dashboardContent) dashboardContent.style.display = "block";

        if (loginMessage) {
            loginMessage.textContent = "";
            loginMessage.className = "";
        }

        renderAdminRoleInfo();
        await loadApplications();

        showToast("Login successful.", "success");

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

    currentAdmin = null;
    allApplications = [];
    currentApplications = [];

    const loginBox = getLoginBox();
    const dashboardContent = getDashboardContent();
    const applicationsContainer = getApplicationsContainer();
    const statsContainer = getStatsContainer();
    const adminInfo = getAdminInfoContainer();
    const permissionsInfo = getPermissionsContainer();

    if (dashboardContent) dashboardContent.style.display = "none";
    if (loginBox) loginBox.style.display = "block";
    if (applicationsContainer) applicationsContainer.innerHTML = "";
    if (statsContainer) statsContainer.innerHTML = "";
    if (adminInfo) adminInfo.innerHTML = "";
    if (permissionsInfo) permissionsInfo.innerHTML = "";

    showToast("Logged out.", "info");
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

    try {
        await loadApplications();
    } catch (error) {
        clearToken();
        clearAdmin();

        if (loginBox) loginBox.style.display = "block";
        if (dashboardContent) dashboardContent.style.display = "none";
    }
}

function renderAdminRoleInfo() {
    const adminInfo = getAdminInfoContainer();
    const permissionsInfo = getPermissionsContainer();

    if (!currentAdmin) return;

    const adminEmail = currentAdmin.email || "Admin";
    const adminRole = currentAdmin.role || "admin";

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

/* =====================================================
   LOAD APPLICATIONS
===================================================== */

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
        const result = await fetchJSON("/api/applications", {
            method: "GET",
            headers: authHeaders()
        });

        allApplications = Array.isArray(result.applications) ? result.applications : [];
        currentApplications = [...allApplications];

        renderStats(allApplications);
        renderFilters();
        renderApplications(currentApplications);
        renderApplicationsChart(allApplications);
        renderApplicationsTable(currentApplications);

    } catch (error) {
        console.error("Load applications error:", error);

        if (applicationsContainer) {
            applicationsContainer.innerHTML = `
                <p class="error-message">${escapeHTML(error.message || "Failed to load applications.")}</p>
            `;
        }
    }
}

/* =====================================================
   STATS
===================================================== */

function renderStats(applications = []) {
    const statsContainer = getStatsContainer();

    const total = applications.length;
    const newCount = applications.filter(app => normaliseStatus(app.status) === "New").length;
    const reviewedCount = applications.filter(app => normaliseStatus(app.status) === "Reviewed").length;
    const interviewCount = applications.filter(app => normaliseStatus(app.status) === "Interview Stage").length;
    const rejectedCount = applications.filter(app => normaliseStatus(app.status) === "Rejected").length;
    const hiredCount = applications.filter(app => normaliseStatus(app.status) === "Hired").length;

    if (byId("totalApplications")) byId("totalApplications").textContent = total;
    if (byId("newApplications")) byId("newApplications").textContent = newCount;
    if (byId("interviewApplications")) byId("interviewApplications").textContent = interviewCount;
    if (byId("hiredApplications")) byId("hiredApplications").textContent = hiredCount;
    if (byId("newThisWeek")) byId("newThisWeek").textContent = getNewThisWeekCount(applications);
    if (byId("interviewPipeline")) byId("interviewPipeline").textContent = interviewCount;
    if (byId("statusBreakdown")) byId("statusBreakdown").textContent = `${newCount}/${reviewedCount}/${interviewCount}`;
    if (byId("applicationsByRole")) byId("applicationsByRole").textContent = getUniqueRolesCount(applications);

    if (!statsContainer) return;

    statsContainer.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Applications</h3>
                <p>${total}</p>
            </div>

            <div class="stat-card">
                <h3>New Applications</h3>
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
                <h3>Rejected</h3>
                <p>${rejectedCount}</p>
            </div>

            <div class="stat-card">
                <h3>Hired</h3>
                <p>${hiredCount}</p>
            </div>
        </div>
    `;
}

function getNewThisWeekCount(applications) {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    return applications.filter(app => {
        const date = app.createdAt ? new Date(app.createdAt) : null;
        return date && !isNaN(date.getTime()) && date >= sevenDaysAgo;
    }).length;
}

function getUniqueRolesCount(applications) {
    const roles = new Set(
        applications
            .map(app => app.position)
            .filter(Boolean)
    );

    return roles.size;
}

/* =====================================================
   CHART
===================================================== */

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
            labels: ["New", "Reviewed", "Interview", "Rejected", "Hired"],
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
                    "#ff6a00",
                    "#ff9900",
                    "#00a8ff",
                    "#c0392b",
                    "#27ae60"
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

/* =====================================================
   FILTERS
===================================================== */

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
            <option value="Interview Stage">Interview Stage</option>
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

    currentApplications = allApplications.filter(app => {
        const searchableText = `
            ${getCandidateName(app)}
            ${app.email || ""}
            ${app.phone || ""}
            ${app.position || ""}
            ${app.about || ""}
            ${app.message || ""}
        `.toLowerCase();

        const matchesSearch =
            !searchValue || searchableText.includes(searchValue);

        const matchesStatus =
            !statusValue || normaliseStatus(app.status) === normaliseStatus(statusValue);

        const matchesRating =
            ratingValue === "" || Number(app.rating || 0) === Number(ratingValue);

        const matchesPosition =
            !positionValue || app.position === positionValue;

        return matchesSearch && matchesStatus && matchesRating && matchesPosition;
    });

    if (filterCount) {
        filterCount.textContent =
            `Showing ${currentApplications.length} of ${allApplications.length} applications`;
    }

    renderApplications(currentApplications);
    renderApplicationsTable(currentApplications);
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

/* =====================================================
   RENDER APPLICATIONS
===================================================== */

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
        const cvLink = getCvLink(app);

        return `
            <div class="application-card">
                <h2>${escapeHTML(getCandidateName(app))}</h2>

                <p><strong>Email:</strong> ${escapeHTML(app.email || "N/A")}</p>
                <p><strong>Phone:</strong> ${escapeHTML(app.phone || "N/A")}</p>
                <p><strong>Position:</strong> ${escapeHTML(app.position || "N/A")}</p>
                <p><strong>Message:</strong> ${escapeHTML(app.about || app.message || "N/A")}</p>
                <p><strong>Status:</strong> ${escapeHTML(status)}</p>
                <p><strong>Rating:</strong> ${escapeHTML(rating)} / 5</p>
                <p><strong>Applied:</strong> ${escapeHTML(formatDate(app.createdAt))}</p>

                ${
                    cvLink
                        ? `<p><a href="${escapeAttribute(cvLink)}" target="_blank">View CV</a></p>`
                        : `<p>No CV uploaded</p>`
                }

                <label>Status</label>
                <select id="status-${id}" ${!canEdit() ? "disabled" : ""}>
                    <option value="New" ${status === "New" ? "selected" : ""}>New</option>
                    <option value="Reviewed" ${status === "Reviewed" ? "selected" : ""}>Reviewed</option>
                    <option value="Interview Stage" ${status === "Interview Stage" ? "selected" : ""}>Interview Stage</option>
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

                <label>Interview Location</label>
                <input type="text" id="interviewLocation-${id}" value="${escapeAttribute(app.interviewLocation || "")}" ${!canEdit() ? "disabled" : ""}>

                <div class="candidate-actions">
                    ${canEdit() ? `<button type="button" onclick="saveApplication('${id}')">Save Updates</button>` : ""}
                    ${canEdit() ? `<button type="button" onclick="markReviewed('${id}')">Mark Reviewed</button>` : ""}
                    ${canInvite() ? `<button type="button" onclick="openInterviewTemplate('${id}')">Invite To Interview</button>` : ""}
                    ${canEdit() ? `<button type="button" onclick="setRejected('${id}')">Reject</button>` : ""}
                    ${canDelete() ? `<button type="button" onclick="deleteApplication('${id}')">Delete</button>` : ""}
                </div>
            </div>
        `;
    }).join("");
}

function renderApplicationsTable(applications) {
    const tableBody = byId("applicationsTableBody");
    if (!tableBody) return;

    if (!applications.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7">No applications found.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = applications.map(app => {
        const id = escapeAttribute(app.id || "");
        const cvLink = getCvLink(app);

        return `
            <tr>
                <td>${escapeHTML(getCandidateName(app))}</td>
                <td>${escapeHTML(app.email || "N/A")}</td>
                <td>${escapeHTML(app.position || "N/A")}</td>
                <td>${escapeHTML(formatDate(app.createdAt))}</td>
                <td>${escapeHTML(app.status || "New")}</td>
                <td>
                    ${
                        cvLink
                            ? `<a href="${escapeAttribute(cvLink)}" target="_blank">CV</a>`
                            : "No CV"
                    }
                </td>
                <td>
                    ${canEdit() ? `<button type="button" onclick="markReviewed('${id}')">Reviewed</button>` : ""}
                    ${canInvite() ? `<button type="button" onclick="openInterviewTemplate('${id}')">Interview</button>` : ""}
                    ${canEdit() ? `<button type="button" onclick="setRejected('${id}')">Reject</button>` : ""}
                    ${canDelete() ? `<button type="button" onclick="deleteApplication('${id}')">Delete</button>` : ""}
                </td>
            </tr>
        `;
    }).join("");
}

/* =====================================================
   SAVE / STATUS / INVITE / DELETE
===================================================== */

async function saveApplication(id) {
    if (!canEdit()) {
        showToast("Permission denied.", "error");
        return;
    }

    const statusField = byId(`status-${id}`);
    const ratingField = byId(`rating-${id}`);
    const notesField = byId(`notes-${id}`);
    const dateField = byId(`interviewDate-${id}`);
    const timeField = byId(`interviewTime-${id}`);
    const locationField = byId(`interviewLocation-${id}`);

    try {
        await fetchJSON(`/api/applications/${id}`, {
            method: "PATCH",
            headers: authHeaders({
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({
                status: statusField ? statusField.value : "New",
                rating: ratingField ? Number(ratingField.value) : 0,
                notes: notesField ? notesField.value : "",
                interviewDate: dateField ? dateField.value : "",
                interviewTime: timeField ? timeField.value : "",
                interviewLocation: locationField ? locationField.value : ""
            })
        });

        showToast("Application updated successfully.", "success");
        await loadApplications();

    } catch (error) {
        console.error("Save error:", error);
        showToast(error.message || "Failed to save application.", "error");
    }
}

async function updateApplicationStatus(id, status) {
    if (!canEdit()) {
        showToast("Permission denied.", "error");
        return;
    }

    try {
        await fetchJSON(`/api/applications/${id}`, {
            method: "PATCH",
            headers: authHeaders({
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({ status })
        });

        showToast(`Candidate marked as ${status}.`, "success");
        await loadApplications();

    } catch (error) {
        console.error("Status update error:", error);
        showToast(error.message || "Failed to update status.", "error");
    }
}

function markReviewed(id) {
    updateApplicationStatus(id, "Reviewed");
}

function setRejected(id) {
    updateApplicationStatus(id, "Rejected");
}

async function openInterviewTemplate(id) {
    if (!canInvite()) {
        showToast("Permission denied.", "error");
        return;
    }

    const app = findApplication(id);

    const dateInput = byId(`interviewDate-${id}`) || byId("interviewDate");
    const timeInput = byId(`interviewTime-${id}`) || byId("interviewTime");
    const locationInput = byId(`interviewLocation-${id}`) || byId("interviewLocation");
    const messageInput = byId("interviewMessage");

    const interviewDate = dateInput ? dateInput.value : "";
    const interviewTime = timeInput ? timeInput.value : "";
    const interviewLocation = locationInput ? locationInput.value : "";
    const interviewMessage = messageInput
        ? messageInput.value
        : "Thank you for your application. We would like to invite you to attend an interview with Joe’s Excellent Events & Management.";

    const confirmed = confirm(
        `Invite ${app ? getCandidateName(app) : "this candidate"} to interview?`
    );

    if (!confirmed) return;

    try {
        await fetchJSON(`/api/applications/${id}/invite`, {
            method: "POST",
            headers: authHeaders({
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({
                interviewDate,
                interviewTime,
                interviewLocation,
                interviewMessage
            })
        });

        showToast("Interview invitation details saved successfully.", "success");
        await loadApplications();

    } catch (error) {
        console.error("Invite error:", error);
        showToast(error.message || "Failed to save interview invitation.", "error");
    }
}

async function deleteApplication(id) {
    if (!canDelete()) {
        showToast("Permission denied.", "error");
        return;
    }

    const confirmed = confirm("Delete this candidate application?");
    if (!confirmed) return;

    try {
        await fetchJSON(`/api/applications/${id}`, {
            method: "DELETE",
            headers: authHeaders()
        });

        showToast("Candidate deleted successfully.", "success");
        await loadApplications();

    } catch (error) {
        console.error("Delete error:", error);
        showToast(error.message || "Failed to delete candidate.", "error");
    }
}

/* =====================================================
   STANDALONE ADMIN NOTES SECTION
===================================================== */

async function saveAdminNotes() {
    const selectedCandidateInput = byId("selectedCandidate");
    const starRatingInput = byId("starRating");
    const candidateNotesInput = byId("candidateNotes");

    if (!selectedCandidateInput || !starRatingInput || !candidateNotesInput) {
        showToast("Notes section is not available on this page.", "error");
        return;
    }

    const candidateName = selectedCandidateInput.value.trim();

    if (!candidateName) {
        showToast("Please enter a candidate name.", "error");
        return;
    }

    const application = allApplications.find(app =>
        getCandidateName(app).toLowerCase() === candidateName.toLowerCase()
    );

    if (!application) {
        showToast("Candidate not found. Please use the exact candidate name.", "error");
        return;
    }

    try {
        await fetchJSON(`/api/applications/${application.id}`, {
            method: "PATCH",
            headers: authHeaders({
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({
                rating: Number(starRatingInput.value || 0),
                notes: candidateNotesInput.value || ""
            })
        });

        showToast("Candidate notes saved successfully.", "success");
        await loadApplications();

    } catch (error) {
        console.error("Notes save error:", error);
        showToast(error.message || "Failed to save notes.", "error");
    }
}

/* =====================================================
   CSV EXPORT
===================================================== */

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
        "Notes",
        "Interview Date",
        "Interview Time",
        "Interview Location",
        "CV"
    ];

    const rows = allApplications.map(app => [
        getCandidateName(app),
        app.email || "",
        app.phone || "",
        app.position || "",
        app.status || "",
        app.rating || "",
        app.notes || "",
        app.interviewDate || "",
        app.interviewTime || "",
        app.interviewLocation || "",
        getCvLink(app)
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "applications.csv";
    link.click();

    URL.revokeObjectURL(link.href);
}

/* =====================================================
   START
===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = byId("loginBtn");
    const logoutBtn = byId("logoutBtn");
    const exportCsvBtn = byId("exportCsvBtn");
    const saveNotesBtn = byId("saveNotesBtn");
    const sendInvitationBtn = byId("sendInvitationBtn");
    const emailInput = byId("adminEmail");
    const passwordInput = byId("adminPassword");

    if (loginBtn) loginBtn.addEventListener("click", loginAdmin);
    if (logoutBtn) logoutBtn.addEventListener("click", logoutAdmin);
    if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCSV);
    if (saveNotesBtn) saveNotesBtn.addEventListener("click", saveAdminNotes);

    if (sendInvitationBtn) {
        sendInvitationBtn.addEventListener("click", () => {
            showToast("Please use the Invite To Interview button on a candidate card.", "info");
        });
    }

    [emailInput, passwordInput].forEach(input => {
        if (input) {
            input.addEventListener("keydown", event => {
                if (event.key === "Enter") loginAdmin();
            });
        }
    });

    restoreSavedLogin();
});

/* =====================================================
   GLOBAL FUNCTIONS FOR INLINE BUTTONS
===================================================== */

window.loginAdmin = loginAdmin;
window.logoutAdmin = logoutAdmin;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.saveApplication = saveApplication;
window.markReviewed = markReviewed;
window.setRejected = setRejected;
window.openInterviewTemplate = openInterviewTemplate;
window.deleteApplication = deleteApplication;
window.exportCSV = exportCSV;
window.saveAdminNotes = saveAdminNotes;