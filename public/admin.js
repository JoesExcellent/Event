/* =====================================================
   TEMC RECRUITMENT ADMIN DASHBOARD - COMPATIBLE VERSION
===================================================== */

const API_BASE_URL = "";

let allApplications = [];
let currentAdmin = null;

function byId(id) {
    return document.getElementById(id);
}

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

function isOwner() {
    return currentAdmin && currentAdmin.role === "owner";
}

function isRecruiter() {
    return currentAdmin && currentAdmin.role === "recruiter";
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

async function fetchJSON(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const text = await response.text();
    let data = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error("Server returned invalid JSON.");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
    return escapeHTML(value).replaceAll("`", "&#096;");
}

function showToast(message, type = "info") {
    const toastContainer = byId("toastContainer");
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => toast.remove(), 3500);
}

function formatDate(value) {
    if (!value) return "Not set";
    const date = value._seconds ? new Date(value._seconds * 1000) : new Date(value);
    return isNaN(date.getTime()) ? "Not set" : date.toLocaleString("en-GB");
}

function normaliseStatus(status) {
    const value = String(status || "New").toLowerCase();
    if (value.includes("review")) return "Reviewed";
    if (value.includes("interview") || value.includes("invited")) return "Interview Stage";
    if (value.includes("reject")) return "Rejected";
    if (value.includes("hire")) return "Hired";
    return "New";
}

function statusClass(status) {
    const clean = normaliseStatus(status);
    if (clean === "Reviewed") return "status-reviewed";
    if (clean === "Interview Stage") return "status-interview";
    if (clean === "Rejected") return "status-rejected";
    if (clean === "Hired") return "status-hired";
    return "status-new";
}

async function loginAdmin() {
    const emailInput = byId("adminEmail");
    const passwordInput = byId("adminPassword");
    const loginMessage = byId("loginMessage");

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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        setToken(result.token);
        currentAdmin = result.admin || { name: "Admin", email, role: "owner" };
        setAdmin(currentAdmin);
        showDashboard();
        loginMessage.textContent = "";
        await loadApplications();
    } catch (error) {
        loginMessage.textContent = error.message || "Login failed. Check your email and password.";
    }
}

function logoutAdmin() {
    clearToken();
    clearAdmin();
    currentAdmin = null;
    allApplications = [];
    byId("loginBox").classList.remove("hidden");
    byId("dashboardContent").classList.add("hidden");
    byId("loginMessage").textContent = "Logged out.";
}

function showDashboard() {
    byId("loginBox").classList.add("hidden");
    byId("dashboardContent").classList.remove("hidden");
    renderAdminInfo();
}

async function restoreSavedLogin() {
    const token = getToken();
    currentAdmin = getAdmin();

    if (!token || !currentAdmin) {
        byId("loginBox").classList.remove("hidden");
        byId("dashboardContent").classList.add("hidden");
        return;
    }

    showDashboard();
    await loadApplications();
}

function renderAdminInfo() {
    const adminInfo = byId("adminInfo");
    if (!adminInfo || !currentAdmin) return;

    adminInfo.innerHTML = `
        <section class="admin-info-card">
            <h2>Admin Information</h2>
            <p><strong>Name:</strong> ${escapeHTML(currentAdmin.name || "Joseph Eldridge")}</p>
            <p><strong>Email:</strong> ${escapeHTML(currentAdmin.email || "")}</p>
            <p><strong>Role:</strong> <span class="admin-role-text">${escapeHTML(currentAdmin.role || "owner")}</span></p>
        </section>
    `;

    const exportCsvBtn = byId("exportCsvBtn");
    if (exportCsvBtn) exportCsvBtn.style.display = canExport() ? "inline-flex" : "none";
}

async function loadApplications() {
    const token = getToken();
    const applicationsContainer = byId("applications");

    if (!token) {
        byId("loginBox").classList.remove("hidden");
        byId("dashboardContent").classList.add("hidden");
        return;
    }

    applicationsContainer.innerHTML = "<p>Loading applications...</p>";

    try {
        const result = await fetchJSON("/api/admin/applications", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });

        allApplications = Array.isArray(result.applications) ? result.applications : [];
    } catch (error) {
        applicationsContainer.innerHTML = `<p class="error-message">${escapeHTML(error.message)}</p>`;
        allApplications = [];
        showToast(error.message || "Could not load applications.", "error");
    }

    renderStats();
    renderApplicationsChart(allApplications);
    renderFilters();
    applyFilters();
}

function renderStats() {
    const statsContainer = byId("stats");
    if (!statsContainer) return;

    const counts = typeof getApplicationCounts === "function"
        ? getApplicationCounts(allApplications)
        : { new: 0, reviewed: 0, interview: 0, rejected: 0, hired: 0 };

    statsContainer.innerHTML = `
        <section class="stats-grid">
            <div class="stat-card"><h3>Total Applications</h3><p>${allApplications.length}</p></div>
            <div class="stat-card"><h3>New</h3><p>${counts.new}</p></div>
            <div class="stat-card"><h3>Reviewed</h3><p>${counts.reviewed}</p></div>
            <div class="stat-card"><h3>Interview Stage</h3><p>${counts.interview}</p></div>
            <div class="stat-card"><h3>Rejected</h3><p>${counts.rejected}</p></div>
            <div class="stat-card"><h3>Hired</h3><p>${counts.hired}</p></div>
        </section>
    `;
}

function renderFilters() {
    const filterBox = byId("filterBox");
    if (!filterBox) return;

    const positions = [...new Set(allApplications.map(app => app.position).filter(Boolean))].sort();

    filterBox.className = "filters-card";
    filterBox.innerHTML = `
        <h2>Search & Filters</h2>
        <div class="filter-grid">
            <div>
                <label for="searchInput">Search</label>
                <input type="text" id="searchInput" placeholder="Search by name, email, phone or position">
            </div>
            <div>
                <label for="statusFilter">Status</label>
                <select id="statusFilter">
                    <option value="">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Reviewed">Reviewed</option>
                    <option value="Interview Stage">Interview Stage</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Hired">Hired</option>
                </select>
            </div>
            <div>
                <label for="ratingFilter">Rating</label>
                <select id="ratingFilter">
                    <option value="">All Ratings</option>
                    <option value="0">0 Stars</option>
                    <option value="1">1 Star</option>
                    <option value="2">2 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="5">5 Stars</option>
                </select>
            </div>
            <div>
                <label for="positionFilter">Position</label>
                <select id="positionFilter">
                    <option value="">All Positions</option>
                    ${positions.map(position => `<option value="${escapeAttr(position)}">${escapeHTML(position)}</option>`).join("")}
                </select>
            </div>
            <button type="button" class="clear-btn small-btn" id="clearFiltersBtn">Clear Filters</button>
        </div>
        <p id="filterCount"></p>
    `;

    byId("searchInput").addEventListener("input", applyFilters);
    byId("statusFilter").addEventListener("change", applyFilters);
    byId("ratingFilter").addEventListener("change", applyFilters);
    byId("positionFilter").addEventListener("change", applyFilters);
    byId("clearFiltersBtn").addEventListener("click", clearFilters);
}

function applyFilters() {
    const searchValue = (byId("searchInput")?.value || "").toLowerCase().trim();
    const statusValue = byId("statusFilter")?.value || "";
    const ratingValue = byId("ratingFilter")?.value || "";
    const positionValue = byId("positionFilter")?.value || "";

    const filteredApplications = allApplications.filter(app => {
        const searchableText = `${app.fullName || ""} ${app.email || ""} ${app.phone || ""} ${app.position || ""} ${app.about || ""}`.toLowerCase();
        const matchesSearch = !searchValue || searchableText.includes(searchValue);
        const matchesStatus = !statusValue || normaliseStatus(app.status) === statusValue;
        const matchesRating = ratingValue === "" || Number(app.rating || 0) === Number(ratingValue);
        const matchesPosition = !positionValue || app.position === positionValue;
        return matchesSearch && matchesStatus && matchesRating && matchesPosition;
    });

    const filterCount = byId("filterCount");
    if (filterCount) filterCount.textContent = `Showing ${filteredApplications.length} of ${allApplications.length} applications`;

    renderApplications(filteredApplications);
}

function clearFilters() {
    if (byId("searchInput")) byId("searchInput").value = "";
    if (byId("statusFilter")) byId("statusFilter").value = "";
    if (byId("ratingFilter")) byId("ratingFilter").value = "";
    if (byId("positionFilter")) byId("positionFilter").value = "";
    applyFilters();
}

function renderApplications(applications) {
    const applicationsContainer = byId("applications");
    if (!applicationsContainer) return;

    if (!applications.length) {
        applicationsContainer.innerHTML = "<section class='application-card'><p>No applications found.</p></section>";
        return;
    }

    applicationsContainer.innerHTML = applications.map(app => {
        const id = escapeAttr(app.id || "");
        const cleanStatus = normaliseStatus(app.status);
        const cvUrl = app.cvUrl || (app.cvFile ? `/uploads/${app.cvFile}` : "");

        return `
            <section class="application-card">
                <span class="status-badge ${statusClass(app.status)}">${escapeHTML(cleanStatus)}</span>
                <h2>${escapeHTML(app.fullName || "Unnamed Candidate")}</h2>
                <div class="card-image-placeholder">Candidate Photograph Placeholder</div>
                <div class="text-placeholder">Add recruiter observations, candidate summary notes, assessment information and interview highlights here.</div>
                <p><strong>Email:</strong> ${escapeHTML(app.email)}</p>
                <p><strong>Phone:</strong> ${escapeHTML(app.phone)}</p>
                <p><strong>Position:</strong> ${escapeHTML(app.position)}</p>
                <p><strong>About:</strong> ${escapeHTML(app.about || app.message || "")}</p>
                <p><strong>Status:</strong> ${escapeHTML(cleanStatus)}</p>
                <p><strong>Rating:</strong> ${escapeHTML(app.rating || 0)} / 5</p>
                <p><strong>Applied:</strong> ${formatDate(app.createdAt)}</p>
                ${cvUrl ? `<p><a href="${escapeAttr(cvUrl)}" target="_blank" rel="noopener">View CV</a></p>` : `<p>No CV uploaded</p>`}

                <label for="status-${id}">Status</label>
                <select id="status-${id}" ${!canEdit() ? "disabled" : ""}>
                    ${["New", "Reviewed", "Interview Stage", "Rejected", "Hired"].map(status => `<option value="${status}" ${cleanStatus === status ? "selected" : ""}>${status}</option>`).join("")}
                </select>

                <label for="rating-${id}">Rating</label>
                <select id="rating-${id}" ${!canEdit() ? "disabled" : ""}>
                    ${[0,1,2,3,4,5].map(num => `<option value="${num}" ${Number(app.rating || 0) === num ? "selected" : ""}>${num}</option>`).join("")}
                </select>

                <label for="notes-${id}">Notes</label>
                <textarea id="notes-${id}" ${!canEdit() ? "readonly" : ""}>${escapeHTML(app.notes || "")}</textarea>

                <div class="interview-grid">
                    <div>
                        <label for="interviewDate-${id}">Interview Date</label>
                        <input type="date" id="interviewDate-${id}" value="${escapeAttr(app.interviewDate || "")}" ${!canEdit() ? "disabled" : ""}>
                    </div>
                    <div>
                        <label for="interviewTime-${id}">Interview Time</label>
                        <input type="time" id="interviewTime-${id}" value="${escapeAttr(app.interviewTime || "")}" ${!canEdit() ? "disabled" : ""}>
                    </div>
                </div>

                <div class="candidate-actions">
                    ${canEdit() ? `<button type="button" class="save-btn small-btn" onclick="saveApplication('${id}')">Save Updates</button>` : ""}
                    ${canEdit() ? `<button type="button" class="reject-btn small-btn" onclick="rejectApplication('${id}')">Reject Candidate</button>` : ""}
                    ${canInvite() ? `<button type="button" class="invite-btn small-btn" onclick="inviteApplication('${id}')">Invite to Interview</button>` : ""}
                    ${canDelete() ? `<button type="button" class="delete-btn small-btn" onclick="deleteApplication('${id}')">Delete Candidate</button>` : ""}
                </div>
            </section>
        `;
    }).join("");
}

async function saveApplication(id) {
    if (!canEdit()) return showToast("Permission denied.", "error");
    const token = getToken();

    try {
        const selectedStatus = byId(`status-${id}`).value;
        await fetchJSON(`/api/admin/applications/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                status: selectedStatus === "Interview Stage" ? "Interview Invited" : selectedStatus,
                rating: Number(byId(`rating-${id}`).value),
                notes: byId(`notes-${id}`).value,
                interviewDate: byId(`interviewDate-${id}`).value,
                interviewTime: byId(`interviewTime-${id}`).value
            })
        });
        showToast("Application updated successfully.", "success");
        await loadApplications();
    } catch (error) {
        showToast(error.message || "Failed to save.", "error");
    }
}

async function rejectApplication(id) {
    if (!canEdit()) return showToast("Permission denied.", "error");
    if (byId(`status-${id}`)) byId(`status-${id}`).value = "Rejected";
    await saveApplication(id);
}

async function inviteApplication(id) {
    if (!canInvite()) return showToast("Permission denied.", "error");
    const token = getToken();

    try {
        await fetchJSON(`/api/admin/applications/${id}/invite`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                interviewDate: byId(`interviewDate-${id}`)?.value || "",
                interviewTime: byId(`interviewTime-${id}`)?.value || ""
            })
        });
        showToast("Interview invitation marked as sent.", "success");
        await loadApplications();
    } catch (error) {
        showToast(error.message || "Failed to invite candidate.", "error");
    }
}

async function deleteApplication(id) {
    if (!canDelete()) return showToast("Only owners can delete candidates.", "error");
    if (!confirm("Delete this candidate?")) return;
    const token = getToken();

    try {
        await fetchJSON(`/api/admin/applications/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
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
            normaliseStatus(app.status),
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

document.addEventListener("DOMContentLoaded", () => {
    byId("loginBtn")?.addEventListener("click", loginAdmin);
    byId("logoutBtn")?.addEventListener("click", logoutAdmin);
    byId("exportCsvBtn")?.addEventListener("click", exportCSV);

    byId("adminPassword")?.addEventListener("keydown", event => {
        if (event.key === "Enter") loginAdmin();
    });

    byId("adminEmail")?.addEventListener("keydown", event => {
        if (event.key === "Enter") loginAdmin();
    });

    restoreSavedLogin();
});
