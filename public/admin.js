/* =====================================================
   ADMIN.JS
   Joe's Excellent Events & Management
   Corrected for current admin.html
===================================================== */

const API_BASE_URL = "";

let authToken = localStorage.getItem("adminToken") || "";
let adminRole = localStorage.getItem("adminRole") || "";
let applications = [];
let selectedApplicationId = "";
let dashboardChart = null;

/* =====================================================
   BASIC HELPERS
===================================================== */

function el(id) {
    return document.getElementById(id);
}

function safeText(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
    };
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-GB") + ", " + date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function showLoginMessage(message, type = "info") {
    const box = el("loginMessage");
    if (!box) return;

    box.textContent = message;

    if (type === "success") {
        box.style.color = "#00d084";
    } else if (type === "error") {
        box.style.color = "#ff6a00";
    } else {
        box.style.color = "#ffffff";
    }
}

function showToast(message, type = "info") {
    const container = el("toastContainer");

    if (!container) {
        alert(message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

/* =====================================================
   LOGIN / LOGOUT
===================================================== */

async function loginAdmin() {
    const email = el("adminEmail") ? el("adminEmail").value.trim() : "";
    const password = el("adminPassword") ? el("adminPassword").value.trim() : "";

    if (!email || !password) {
        showLoginMessage("Please enter your admin email and password.", "error");
        return;
    }

    showLoginMessage("Logging in...", "info");

    try {
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Invalid email or password.");
        }

        authToken = result.token;
        adminRole = result.role || "admin";

        localStorage.setItem("adminToken", authToken);
        localStorage.setItem("adminRole", adminRole);

        showDashboard();
        await loadApplications();

        showToast("Login successful.", "success");

    } catch (error) {
        showLoginMessage(error.message || "Login failed.", "error");
    }
}

function logoutAdmin() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");

    authToken = "";
    adminRole = "";
    applications = [];
    selectedApplicationId = "";

    if (el("loginBox")) el("loginBox").style.display = "block";
    if (el("dashboardContent")) el("dashboardContent").style.display = "none";

    showLoginMessage("Logged out.", "info");
}

function showDashboard() {
    if (el("loginBox")) el("loginBox").style.display = "none";
    if (el("dashboardContent")) el("dashboardContent").style.display = "block";

    if (el("adminInfo")) {
        el("adminInfo").innerHTML = `Logged in as <strong>${safeText(adminRole || "admin")}</strong>`;
    }

    if (el("permissionsInfo")) {
        el("permissionsInfo").innerHTML = `
            <strong>Permissions</strong><br>
            Admin users can review applications, update candidates, manage interview invitations and export recruitment data.
        `;
    }
}

/* =====================================================
   LOAD APPLICATIONS
===================================================== */

async function loadApplications() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/applications`, {
            method: "GET",
            headers: getHeaders()
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Could not load applications.");
        }

        applications = result.applications || [];

        updateDashboard();

    } catch (error) {
        console.error("Load applications error:", error);

        if (
            error.message.includes("expired") ||
            error.message.includes("token") ||
            error.message.includes("401")
        ) {
            logoutAdmin();
        }

        showToast(error.message || "Could not load applications.", "error");
    }
}

/* =====================================================
   DASHBOARD UPDATE
===================================================== */

function updateDashboard() {
    updateStats();
    renderApplicationsTable();
    renderApplicationsCards();
    updateAnalytics();
    renderChart();
}

function updateStats() {
    const total = applications.length;

    const newCount = applications.filter(app => (app.status || "New") === "New").length;

    const interviewCount = applications.filter(app =>
        ["Interview Invited", "Interview Stage", "To Be Interviewed"].includes(app.status)
    ).length;

    const hiredCount = applications.filter(app =>
        ["Hired", "Successful"].includes(app.status)
    ).length;

    if (el("totalApplications")) el("totalApplications").textContent = total;
    if (el("newApplications")) el("newApplications").textContent = newCount;
    if (el("interviewApplications")) el("interviewApplications").textContent = interviewCount;
    if (el("hiredApplications")) el("hiredApplications").textContent = hiredCount;

    if (el("stats")) {
        el("stats").innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <span>1</span>
                    <h3>Total Applications</h3>
                    <p>${total}</p>
                </div>

                <div class="stat-card">
                    <span>2</span>
                    <h3>New</h3>
                    <p>${newCount}</p>
                </div>

                <div class="stat-card">
                    <span>3</span>
                    <h3>Interview Stage</h3>
                    <p>${interviewCount}</p>
                </div>

                <div class="stat-card">
                    <span>4</span>
                    <h3>Hired</h3>
                    <p>${hiredCount}</p>
                </div>
            </div>
        `;
    }
}

function updateAnalytics() {
    const roles = new Set(applications.map(app => app.position).filter(Boolean));
    const statuses = new Set(applications.map(app => app.status || "New"));

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const newThisWeek = applications.filter(app => {
        const created = new Date(app.createdAt);
        return !Number.isNaN(created.getTime()) && created >= sevenDaysAgo;
    }).length;

    const interviewPipeline = applications.filter(app =>
        ["Interview Invited", "Interview Stage", "To Be Interviewed"].includes(app.status)
    ).length;

    if (el("applicationsByRole")) el("applicationsByRole").textContent = roles.size;
    if (el("statusBreakdown")) el("statusBreakdown").textContent = statuses.size;
    if (el("newThisWeek")) el("newThisWeek").textContent = newThisWeek;
    if (el("interviewPipeline")) el("interviewPipeline").textContent = interviewPipeline;
}

/* =====================================================
   RENDER APPLICATIONS TABLE
===================================================== */

function renderApplicationsTable() {
    const tbody = el("applicationsTableBody");
    if (!tbody) return;

    if (!applications.length) {
        tbody.innerHTML = `<tr><td colspan="7">No applications found.</td></tr>`;
        return;
    }

    tbody.innerHTML = applications.map(app => `
        <tr>
            <td>${safeText(app.fullName)}</td>
            <td>${safeText(app.email)}</td>
            <td>${safeText(app.position)}</td>
            <td>${formatDate(app.createdAt)}</td>
            <td>${safeText(app.status || "New")}</td>
            <td>${app.cv ? `<a href="${safeText(app.cv)}" target="_blank">CV</a>` : "No CV"}</td>
            <td>
                <button type="button" onclick="selectCandidate('${app.id}')">View</button>
                <button type="button" onclick="markReviewed('${app.id}')">Reviewed</button>
                <button type="button" onclick="prepareInterviewInvite('${app.id}')">Interview</button>
                <button type="button" onclick="rejectCandidate('${app.id}')">Reject</button>
                <button type="button" onclick="deleteApplication('${app.id}')">Delete</button>
            </td>
        </tr>
    `).join("");
}

/* =====================================================
   RENDER APPLICATION CARDS
===================================================== */

function renderApplicationsCards() {
    const container = el("applications");
    if (!container) return;

    if (!applications.length) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = applications.map(app => {
        const extraFiles = Array.isArray(app.extraFiles) ? app.extraFiles : [];

        return `
            <div class="application-card">
                <h3>${safeText(app.fullName)}</h3>

                <p><strong>Email:</strong> ${safeText(app.email)}</p>
                <p><strong>Phone:</strong> ${safeText(app.phone)}</p>
                <p><strong>Address:</strong> ${safeText(app.address)}</p>
                <p><strong>Position:</strong> ${safeText(app.position)}</p>
                <p><strong>Availability:</strong> ${safeText(app.availability)}</p>
                <p><strong>Status:</strong> ${safeText(app.status || "New")}</p>
                <p><strong>Date Applied:</strong> ${formatDate(app.createdAt)}</p>

                <p><strong>About Candidate:</strong></p>
                <p>${safeText(app.message)}</p>

                <p>
                    <strong>CV:</strong>
                    ${app.cv ? `<a href="${safeText(app.cv)}" target="_blank">Download CV</a>` : "No CV uploaded"}
                </p>

                <p><strong>Additional Files:</strong></p>
                <ul>
                    ${
                        extraFiles.length
                            ? extraFiles.map(file => `<li><a href="${safeText(file)}" target="_blank">Download File</a></li>`).join("")
                            : "<li>No additional files uploaded</li>"
                    }
                </ul>

                <label for="status-${app.id}">Status</label>
                <select id="status-${app.id}">
                    <option value="New" ${(app.status || "New") === "New" ? "selected" : ""}>New</option>
                    <option value="Reviewed" ${app.status === "Reviewed" ? "selected" : ""}>Reviewed</option>
                    <option value="Interview Invited" ${app.status === "Interview Invited" ? "selected" : ""}>Interview Invited</option>
                    <option value="Rejected" ${app.status === "Rejected" ? "selected" : ""}>Rejected</option>
                    <option value="Hired" ${app.status === "Hired" ? "selected" : ""}>Hired</option>
                </select>

                <label for="rating-${app.id}">Rating</label>
                <select id="rating-${app.id}">
                    <option value="0" ${Number(app.rating || 0) === 0 ? "selected" : ""}>No rating</option>
                    <option value="1" ${Number(app.rating || 0) === 1 ? "selected" : ""}>1 Star</option>
                    <option value="2" ${Number(app.rating || 0) === 2 ? "selected" : ""}>2 Stars</option>
                    <option value="3" ${Number(app.rating || 0) === 3 ? "selected" : ""}>3 Stars</option>
                    <option value="4" ${Number(app.rating || 0) === 4 ? "selected" : ""}>4 Stars</option>
                    <option value="5" ${Number(app.rating || 0) === 5 ? "selected" : ""}>5 Stars</option>
                </select>

                <label for="notes-${app.id}">Notes</label>
                <textarea id="notes-${app.id}">${safeText(app.notes || "")}</textarea>

                <label for="cardInterviewDate-${app.id}">Interview Date</label>
                <input type="date" id="cardInterviewDate-${app.id}" value="${safeText(app.interviewDate || "")}">

                <label for="cardInterviewTime-${app.id}">Interview Time</label>
                <input type="time" id="cardInterviewTime-${app.id}" value="${safeText(app.interviewTime || "")}">

                <button type="button" onclick="saveCandidate('${app.id}')">Save Updates</button>
                <button type="button" onclick="markReviewed('${app.id}')">Mark Reviewed</button>
                <button type="button" onclick="prepareInterviewInvite('${app.id}')">Invite To Interview</button>
                <button type="button" onclick="rejectCandidate('${app.id}')">Reject</button>
                <button type="button" onclick="deleteApplication('${app.id}')">Delete</button>
            </div>
        `;
    }).join("");
}

/* =====================================================
   UPDATE APPLICATION
===================================================== */

async function updateApplication(id, updateData) {
    const response = await fetch(`${API_BASE_URL}/api/applications/${id}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(updateData)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || "Update failed.");
    }

    await loadApplications();
}

async function saveCandidate(id) {
    try {
        const status = el(`status-${id}`)?.value || "New";
        const rating = Number(el(`rating-${id}`)?.value || 0);
        const notes = el(`notes-${id}`)?.value || "";
        const interviewDate = el(`cardInterviewDate-${id}`)?.value || "";
        const interviewTime = el(`cardInterviewTime-${id}`)?.value || "";

        await updateApplication(id, {
            status,
            rating,
            notes,
            interviewDate,
            interviewTime
        });

        showToast("Candidate updated successfully.", "success");

    } catch (error) {
        showToast(error.message || "Could not save candidate.", "error");
    }
}

async function markReviewed(id) {
    try {
        await updateApplication(id, { status: "Reviewed" });
        showToast("Candidate marked as reviewed.", "success");
    } catch (error) {
        showToast(error.message || "Could not mark candidate as reviewed.", "error");
    }
}

async function rejectCandidate(id) {
    if (!confirm("Reject this candidate?")) return;

    try {
        await updateApplication(id, { status: "Rejected" });
        showToast("Candidate rejected.", "success");
    } catch (error) {
        showToast(error.message || "Could not reject candidate.", "error");
    }
}

async function deleteApplication(id) {
    if (!confirm("Delete this application permanently?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/applications/${id}`, {
            method: "DELETE",
            headers: getHeaders()
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Delete failed.");
        }

        await loadApplications();
        showToast("Application deleted.", "success");

    } catch (error) {
        showToast(error.message || "Could not delete application.", "error");
    }
}

/* =====================================================
   INTERVIEW INVITATION
===================================================== */

function selectCandidate(id) {
    const app = applications.find(item => item.id === id);
    if (!app) return;

    selectedApplicationId = id;

    if (el("selectedCandidate")) {
        el("selectedCandidate").value = app.fullName || "";
    }

    if (el("starRating")) {
        el("starRating").value = String(app.rating || "");
    }

    if (el("candidateNotes")) {
        el("candidateNotes").value = app.notes || "";
    }

    prepareInterviewInvite(id);
}

function prepareInterviewInvite(id) {
    const app = applications.find(item => item.id === id);

    if (!app) {
        showToast("Candidate not found.", "error");
        return;
    }

    selectedApplicationId = id;

    if (el("candidateName")) {
        el("candidateName").value = app.fullName || "";
    }

    if (el("interviewDate")) {
        el("interviewDate").value = app.interviewDate || "";
    }

    if (el("interviewTime")) {
        el("interviewTime").value = app.interviewTime || "";
    }

    if (el("interviewLocation")) {
        el("interviewLocation").value =
            app.interviewLocation ||
            "Joe's Excellent Events & Management, Newcastle upon Tyne";
    }

    if (el("interviewMessage")) {
        el("interviewMessage").value =
`Dear ${app.fullName || "Candidate"},

Thank you for your application to Joe's Excellent Events & Management.

We are pleased to invite you to attend an interview for the position of ${app.position || "the role you applied for"}.

We would like to discuss your application, experience, skills and interest in joining our team.

Please reply to confirm that you are able to attend.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`;
    }

    showToast(`Interview template prepared for ${app.fullName}.`, "success");
}

async function sendInvitation() {
    if (!selectedApplicationId) {
        showToast("Please select a candidate first.", "error");
        return;
    }

    const app = applications.find(item => item.id === selectedApplicationId);

    if (!app) {
        showToast("Candidate not found.", "error");
        return;
    }

    const date = el("interviewDate")?.value || "";
    const time = el("interviewTime")?.value || "";
    const location = el("interviewLocation")?.value || "";
    const message = el("interviewMessage")?.value || "";

    if (!date || !time || !location) {
        showToast("Please enter interview date, time and location.", "error");
        return;
    }

    if (!confirm(`Send interview invitation email to ${app.fullName}?`)) {
        return;
    }

    showToast("Sending interview invitation email...", "info");

    try {
        const response = await fetch(`${API_BASE_URL}/api/applications/${selectedApplicationId}/invite`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
                interviewDate: date,
                interviewTime: time,
                interviewLocation: location,
                interviewMessage: message
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Email invitation failed.");
        }

        showToast(`Interview invitation sent successfully to ${app.email}.`, "success");

        await loadApplications();

    } catch (error) {
        showToast(error.message || "Could not send invitation email.", "error");
    }
}

async function saveNotes() {
    if (!selectedApplicationId) {
        showToast("Please select a candidate first.", "error");
        return;
    }

    try {
        const rating = Number(el("starRating")?.value || 0);
        const notes = el("candidateNotes")?.value || "";

        await updateApplication(selectedApplicationId, {
            rating,
            notes
        });

        showToast("Admin notes saved.", "success");

    } catch (error) {
        showToast(error.message || "Could not save notes.", "error");
    }
}

/* =====================================================
   EXPORT CSV
===================================================== */

function exportCsv() {
    if (!applications.length) {
        showToast("No applications to export.", "error");
        return;
    }

    const headers = [
        "Name",
        "Email",
        "Phone",
        "Address",
        "Position",
        "Availability",
        "Status",
        "Rating",
        "Date Applied",
        "Notes"
    ];

    const rows = applications.map(app => [
        app.fullName || "",
        app.email || "",
        app.phone || "",
        app.address || "",
        app.position || "",
        app.availability || "",
        app.status || "New",
        app.rating || "",
        app.createdAt || "",
        app.notes || ""
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "applications.csv";
    link.click();

    URL.revokeObjectURL(url);
}

/* =====================================================
   CHART
===================================================== */

function renderChart() {
    const canvas = el("applicationsChart");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    const counts = {
        New: 0,
        Reviewed: 0,
        "Interview Invited": 0,
        Rejected: 0,
        Hired: 0
    };

    applications.forEach(app => {
        const status = app.status || "New";

        if (counts[status] !== undefined) {
            counts[status]++;
        }
    });

    if (dashboardChart) {
        dashboardChart.destroy();
    }

    dashboardChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: Object.keys(counts),
            datasets: [{
                label: "Applications",
                data: Object.values(counts),
                backgroundColor: [
                    "#ff6a00",
                    "#ffaa00",
                    "#00a8ff",
                    "#c0392b",
                    "#27ae60"
                ]
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
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#ffffff",
                        precision: 0
                    }
                }
            }
        }
    });
}

/* =====================================================
   STARTUP
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
    if (el("logoutBtn")) {
        el("logoutBtn").addEventListener("click", logoutAdmin);
    }

    if (el("exportCsvBtn")) {
        el("exportCsvBtn").addEventListener("click", exportCsv);
    }

    if (el("sendInvitationBtn")) {
        el("sendInvitationBtn").addEventListener("click", sendInvitation);
    }

    if (el("saveNotesBtn")) {
        el("saveNotesBtn").addEventListener("click", saveNotes);
    }

    if (authToken) {
        showDashboard();
        await loadApplications();
    } else {
        if (el("loginBox")) el("loginBox").style.display = "block";
        if (el("dashboardContent")) el("dashboardContent").style.display = "none";
    }
});

/* =====================================================
   GLOBAL FUNCTIONS FOR HTML BUTTONS
===================================================== */

window.loginAdmin = loginAdmin;
window.logoutAdmin = logoutAdmin;
window.selectCandidate = selectCandidate;
window.prepareInterviewInvite = prepareInterviewInvite;
window.saveCandidate = saveCandidate;
window.markReviewed = markReviewed;
window.rejectCandidate = rejectCandidate;
window.deleteApplication = deleteApplication;
window.sendInvitation = sendInvitation;
window.saveNotes = saveNotes;
window.exportCsv = exportCsv;