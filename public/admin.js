/* =====================================================
   ADMIN.JS
   Joe's Excellent Events & Management
   Admin Dashboard + Interview Invitation Email
===================================================== */

const API_BASE_URL = "";

let authToken = localStorage.getItem("adminToken") || "";
let applications = [];
let selectedApplicationId = "";

/* =====================================================
   DOM ELEMENTS
===================================================== */

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginForm = document.getElementById("loginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const loginMessage = document.getElementById("loginMessage");

const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");

const applicationsTableBody = document.getElementById("applicationsTableBody");
const applicationsList = document.getElementById("applicationsList");

const totalApplicationsEl = document.getElementById("totalApplications");
const newApplicationsEl = document.getElementById("newApplications");
const reviewedApplicationsEl = document.getElementById("reviewedApplications");
const interviewApplicationsEl = document.getElementById("interviewApplications");
const rejectedApplicationsEl = document.getElementById("rejectedApplications");
const hiredApplicationsEl = document.getElementById("hiredApplications");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const positionFilter = document.getElementById("positionFilter");

const inviteCandidateName = document.getElementById("inviteCandidateName");
const inviteCandidateEmail = document.getElementById("inviteCandidateEmail");
const invitePosition = document.getElementById("invitePosition");
const interviewDate = document.getElementById("interviewDate");
const interviewTime = document.getElementById("interviewTime");
const interviewLocation = document.getElementById("interviewLocation");
const interviewMessage = document.getElementById("interviewMessage");
const sendInviteBtn = document.getElementById("sendInviteBtn");
const inviteMessage = document.getElementById("inviteMessage");

/* =====================================================
   HELPERS
===================================================== */

function showMessage(element, message, type = "info") {
    if (!element) return;

    element.textContent = message;

    if (type === "success") {
        element.style.color = "#00d084";
    } else if (type === "error") {
        element.style.color = "#ff6a00";
    } else {
        element.style.color = "#ffffff";
    }
}

function getAuthHeaders() {
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

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =====================================================
   LOGIN / LOGOUT
===================================================== */

async function loginAdmin(event) {
    event.preventDefault();

    showMessage(loginMessage, "Logging in...", "info");

    try {
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: adminEmail.value.trim(),
                password: adminPassword.value.trim()
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Login failed.");
        }

        authToken = result.token;
        localStorage.setItem("adminToken", authToken);

        showDashboard();
        await loadApplications();

    } catch (error) {
        showMessage(loginMessage, error.message || "Invalid email or password.", "error");
    }
}

function logoutAdmin() {
    localStorage.removeItem("adminToken");
    authToken = "";
    applications = [];
    selectedApplicationId = "";

    if (loginSection) loginSection.classList.remove("hidden");
    if (dashboardSection) dashboardSection.classList.add("hidden");
}

function showDashboard() {
    if (loginSection) loginSection.classList.add("hidden");
    if (dashboardSection) dashboardSection.classList.remove("hidden");
}

/* =====================================================
   LOAD APPLICATIONS
===================================================== */

async function loadApplications() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/applications`, {
            method: "GET",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Could not load applications.");
        }

        applications = result.applications || [];

        updateStats();
        renderApplications();
        buildPositionFilter();

    } catch (error) {
        console.error("Load applications error:", error);
        alert(error.message || "Could not load applications.");
    }
}

/* =====================================================
   STATS
===================================================== */

function updateStats() {
    const total = applications.length;
    const newCount = applications.filter(app => app.status === "New").length;
    const reviewedCount = applications.filter(app => app.status === "Reviewed").length;
    const interviewCount = applications.filter(app =>
        app.status === "Interview Invited" ||
        app.status === "Interview Stage" ||
        app.status === "To Be Interviewed"
    ).length;
    const rejectedCount = applications.filter(app => app.status === "Rejected").length;
    const hiredCount = applications.filter(app =>
        app.status === "Hired" ||
        app.status === "Successful"
    ).length;

    if (totalApplicationsEl) totalApplicationsEl.textContent = total;
    if (newApplicationsEl) newApplicationsEl.textContent = newCount;
    if (reviewedApplicationsEl) reviewedApplicationsEl.textContent = reviewedCount;
    if (interviewApplicationsEl) interviewApplicationsEl.textContent = interviewCount;
    if (rejectedApplicationsEl) rejectedApplicationsEl.textContent = rejectedCount;
    if (hiredApplicationsEl) hiredApplicationsEl.textContent = hiredCount;
}

/* =====================================================
   FILTERING
===================================================== */

function getFilteredApplications() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const statusValue = statusFilter ? statusFilter.value : "";
    const positionValue = positionFilter ? positionFilter.value : "";

    return applications.filter(app => {
        const searchText = `
            ${app.fullName || ""}
            ${app.email || ""}
            ${app.phone || ""}
            ${app.position || ""}
            ${app.message || ""}
        `.toLowerCase();

        const matchesSearch = !searchTerm || searchText.includes(searchTerm);
        const matchesStatus = !statusValue || app.status === statusValue;
        const matchesPosition = !positionValue || app.position === positionValue;

        return matchesSearch && matchesStatus && matchesPosition;
    });
}

function buildPositionFilter() {
    if (!positionFilter) return;

    const currentValue = positionFilter.value;
    const positions = [...new Set(applications.map(app => app.position).filter(Boolean))];

    positionFilter.innerHTML = `<option value="">All Positions</option>`;

    positions.forEach(position => {
        const option = document.createElement("option");
        option.value = position;
        option.textContent = position;
        positionFilter.appendChild(option);
    });

    positionFilter.value = currentValue;
}

/* =====================================================
   RENDER APPLICATIONS
===================================================== */

function renderApplications() {
    const filteredApplications = getFilteredApplications();

    renderApplicationsTable(filteredApplications);
    renderApplicationCards(filteredApplications);
}

function renderApplicationsTable(list) {
    if (!applicationsTableBody) return;

    applicationsTableBody.innerHTML = "";

    list.forEach(app => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHtml(app.fullName)}</td>
            <td>${escapeHtml(app.email)}</td>
            <td>${escapeHtml(app.position)}</td>
            <td>${formatDate(app.createdAt)}</td>
            <td>${escapeHtml(app.status || "New")}</td>
            <td>
                ${app.cv ? `<a href="${app.cv}" target="_blank">CV</a>` : "No CV"}
            </td>
            <td>
                <button onclick="selectCandidate('${app.id}')">View</button>
                <button onclick="markReviewed('${app.id}')">Reviewed</button>
                <button onclick="prepareInterviewInvite('${app.id}')">Interview</button>
                <button onclick="rejectCandidate('${app.id}')">Reject</button>
                <button onclick="deleteApplication('${app.id}')">Delete</button>
            </td>
        `;

        applicationsTableBody.appendChild(row);
    });
}

function renderApplicationCards(list) {
    if (!applicationsList) return;

    applicationsList.innerHTML = "";

    list.forEach(app => {
        const card = document.createElement("div");
        card.className = "candidate-card";

        const extraFiles = Array.isArray(app.extraFiles) ? app.extraFiles : [];

        card.innerHTML = `
            <h3>${escapeHtml(app.fullName)}</h3>

            <p><strong>Email:</strong> ${escapeHtml(app.email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(app.phone)}</p>
            <p><strong>Address:</strong> ${escapeHtml(app.address)}</p>
            <p><strong>Position:</strong> ${escapeHtml(app.position)}</p>
            <p><strong>Availability:</strong> ${escapeHtml(app.availability)}</p>
            <p><strong>Status:</strong> ${escapeHtml(app.status || "New")}</p>
            <p><strong>Date Applied:</strong> ${formatDate(app.createdAt)}</p>

            <p><strong>About Candidate:</strong></p>
            <p>${escapeHtml(app.message)}</p>

            <p>
                <strong>CV:</strong>
                ${app.cv ? `<a href="${app.cv}" target="_blank">Download CV</a>` : "No CV uploaded"}
            </p>

            <p><strong>Additional Files:</strong></p>
            <ul>
                ${
                    extraFiles.length
                        ? extraFiles.map(file => `<li><a href="${file}" target="_blank">Download File</a></li>`).join("")
                        : "<li>No additional files uploaded</li>"
                }
            </ul>

            <label>Status</label>
            <select id="status-${app.id}">
                <option value="New" ${app.status === "New" ? "selected" : ""}>New</option>
                <option value="Reviewed" ${app.status === "Reviewed" ? "selected" : ""}>Reviewed</option>
                <option value="Interview Invited" ${app.status === "Interview Invited" ? "selected" : ""}>Interview Invited</option>
                <option value="Rejected" ${app.status === "Rejected" ? "selected" : ""}>Rejected</option>
                <option value="Hired" ${app.status === "Hired" ? "selected" : ""}>Hired</option>
            </select>

            <label>Rating</label>
            <select id="rating-${app.id}">
                <option value="0" ${Number(app.rating) === 0 ? "selected" : ""}>No rating</option>
                <option value="1" ${Number(app.rating) === 1 ? "selected" : ""}>⭐</option>
                <option value="2" ${Number(app.rating) === 2 ? "selected" : ""}>⭐⭐</option>
                <option value="3" ${Number(app.rating) === 3 ? "selected" : ""}>⭐⭐⭐</option>
                <option value="4" ${Number(app.rating) === 4 ? "selected" : ""}>⭐⭐⭐⭐</option>
                <option value="5" ${Number(app.rating) === 5 ? "selected" : ""}>⭐⭐⭐⭐⭐</option>
            </select>

            <label>Notes</label>
            <textarea id="notes-${app.id}">${escapeHtml(app.notes || "")}</textarea>

            <label>Interview Date</label>
            <input type="date" id="interviewDate-${app.id}" value="${escapeHtml(app.interviewDate || "")}">

            <label>Interview Time</label>
            <input type="time" id="interviewTime-${app.id}" value="${escapeHtml(app.interviewTime || "")}">

            <div class="candidate-actions">
                <button onclick="saveCandidate('${app.id}')">Save Updates</button>
                <button onclick="markReviewed('${app.id}')">Mark Reviewed</button>
                <button onclick="prepareInterviewInvite('${app.id}')">Invite To Interview</button>
                <button onclick="rejectCandidate('${app.id}')">Reject</button>
                <button onclick="deleteApplication('${app.id}')">Delete</button>
            </div>
        `;

        applicationsList.appendChild(card);
    });
}

/* =====================================================
   UPDATE APPLICATIONS
===================================================== */

async function updateApplication(id, updateData) {
    const response = await fetch(`${API_BASE_URL}/api/applications/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
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
        const status = document.getElementById(`status-${id}`)?.value || "New";
        const rating = document.getElementById(`rating-${id}`)?.value || "0";
        const notes = document.getElementById(`notes-${id}`)?.value || "";
        const date = document.getElementById(`interviewDate-${id}`)?.value || "";
        const time = document.getElementById(`interviewTime-${id}`)?.value || "";

        await updateApplication(id, {
            status,
            rating: Number(rating),
            notes,
            interviewDate: date,
            interviewTime: time
        });

        alert("Candidate updated successfully.");

    } catch (error) {
        alert(error.message || "Could not save candidate.");
    }
}

async function markReviewed(id) {
    try {
        await updateApplication(id, { status: "Reviewed" });
    } catch (error) {
        alert(error.message || "Could not mark candidate as reviewed.");
    }
}

async function rejectCandidate(id) {
    try {
        if (!confirm("Reject this candidate?")) return;
        await updateApplication(id, { status: "Rejected" });
    } catch (error) {
        alert(error.message || "Could not reject candidate.");
    }
}

async function deleteApplication(id) {
    try {
        if (!confirm("Delete this application permanently?")) return;

        const response = await fetch(`${API_BASE_URL}/api/applications/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Delete failed.");
        }

        await loadApplications();

    } catch (error) {
        alert(error.message || "Could not delete application.");
    }
}

/* =====================================================
   INTERVIEW INVITATION TEMPLATE
===================================================== */

function selectCandidate(id) {
    const app = applications.find(item => item.id === id);
    if (!app) return;

    selectedApplicationId = id;
    prepareInterviewInvite(id);

    document.getElementById(`notes-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

function prepareInterviewInvite(id) {
    const app = applications.find(item => item.id === id);

    if (!app) {
        alert("Candidate not found.");
        return;
    }

    selectedApplicationId = id;

    if (inviteCandidateName) inviteCandidateName.value = app.fullName || "";
    if (inviteCandidateEmail) inviteCandidateEmail.value = app.email || "";
    if (invitePosition) invitePosition.value = app.position || "";

    if (interviewDate) {
        interviewDate.value = app.interviewDate || "";
    }

    if (interviewTime) {
        interviewTime.value = app.interviewTime || "";
    }

    if (interviewLocation) {
        interviewLocation.value = app.interviewLocation || "Joe's Excellent Events & Management, Newcastle upon Tyne";
    }

    if (interviewMessage) {
        interviewMessage.value =
`Dear ${app.fullName || "Candidate"},

Thank you for your application to Joe's Excellent Events & Management.

We are pleased to invite you to attend an interview for the position of ${app.position || "the role you applied for"}.

We would like to discuss your application, experience, skills and interest in joining our team.

Please reply to confirm that you are able to attend.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`;
    }

    showMessage(inviteMessage, `Invitation template prepared for ${app.fullName}.`, "success");

    const invitationSection = document.getElementById("interviewInvitationSection");
    if (invitationSection) {
        invitationSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

async function sendInterviewInvitation() {
    if (!selectedApplicationId) {
        showMessage(inviteMessage, "Please select a candidate first.", "error");
        return;
    }

    const app = applications.find(item => item.id === selectedApplicationId);

    if (!app) {
        showMessage(inviteMessage, "Candidate could not be found.", "error");
        return;
    }

    if (!interviewDate?.value || !interviewTime?.value || !interviewLocation?.value) {
        showMessage(inviteMessage, "Please enter interview date, time and location.", "error");
        return;
    }

    const confirmed = confirm(`Send interview invitation email to ${app.fullName}?`);

    if (!confirmed) return;

    showMessage(inviteMessage, "Sending interview invitation email...", "info");

    try {
        const response = await fetch(`${API_BASE_URL}/api/applications/${selectedApplicationId}/invite`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                interviewDate: interviewDate.value,
                interviewTime: interviewTime.value,
                interviewLocation: interviewLocation.value,
                interviewMessage: interviewMessage.value
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Email invitation failed.");
        }

        showMessage(
            inviteMessage,
            `✅ Interview invitation sent successfully to ${app.email}.`,
            "success"
        );

        await loadApplications();

    } catch (error) {
        console.error("Interview invitation error:", error);
        showMessage(inviteMessage, error.message || "Could not send interview invitation email.", "error");
    }
}

/* =====================================================
   EVENTS
===================================================== */

if (loginForm) {
    loginForm.addEventListener("submit", loginAdmin);
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutAdmin);
}

if (refreshBtn) {
    refreshBtn.addEventListener("click", loadApplications);
}

if (sendInviteBtn) {
    sendInviteBtn.addEventListener("click", sendInterviewInvitation);
}

if (searchInput) {
    searchInput.addEventListener("input", renderApplications);
}

if (statusFilter) {
    statusFilter.addEventListener("change", renderApplications);
}

if (positionFilter) {
    positionFilter.addEventListener("change", renderApplications);
}

/* =====================================================
   STARTUP
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
    if (authToken) {
        showDashboard();
        await loadApplications();
    } else {
        if (loginSection) loginSection.classList.remove("hidden");
        if (dashboardSection) dashboardSection.classList.add("hidden");
    }
});