const API_BASE = "";

let authToken = localStorage.getItem("adminToken") || "";
let adminRole = localStorage.getItem("adminRole") || "";
let selectedApplicationId = null;
let selectedContactMessageId = null;

let allApplications = [];
let allContactMessages = [];

const loginBox = document.getElementById("loginBox");
const dashboardContent = document.getElementById("dashboardContent");
const loginMessage = document.getElementById("loginMessage");
const adminInfo = document.getElementById("adminInfo");
const permissionsInfo = document.getElementById("permissionsInfo");

const applicationsTableBody = document.getElementById("applicationsTableBody");
const contactMessagesTableBody = document.getElementById("contactMessagesTableBody");

const totalApplications = document.getElementById("totalApplications");
const newApplications = document.getElementById("newApplications");
const interviewApplications = document.getElementById("interviewApplications");
const hiredApplications = document.getElementById("hiredApplications");

const applicationsByRole = document.getElementById("applicationsByRole");
const statusBreakdown = document.getElementById("statusBreakdown");
const newThisWeek = document.getElementById("newThisWeek");
const interviewPipeline = document.getElementById("interviewPipeline");

const ATS_STATUSES = [
    "New",
    "Screening",
    "Shortlisted",
    "Interview Invited",
    "Interview Completed",
    "Offer Made",
    "Hired",
    "Rejected",
    "Archived"
];

function showToast(message, type = "info") {
    const toastContainer = document.getElementById("toastContainer");

    if (!toastContainer) {
        alert(message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function setDashboardVisible(show) {
    if (loginBox) {
        loginBox.style.display = show ? "none" : "block";
    }

    if (dashboardContent) {
        dashboardContent.style.display = show ? "block" : "none";
    }
}

function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
    };
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeForAttribute(value) {
    return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, "&quot;")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "");
}

function formatDate(dateString) {
    if (!dateString) return "N/A";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatDateTime(dateString) {
    if (!dateString) return "N/A";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function normaliseStatus(status) {
    return status || "New";
}

function buildStatusOptions(currentStatus) {
    const activeStatus = normaliseStatus(currentStatus);

    return ATS_STATUSES.map(status => {
        const selected = status === activeStatus ? "selected" : "";
        return `<option value="${escapeHtml(status)}" ${selected}>${escapeHtml(status)}</option>`;
    }).join("");
}

function getStatusBadge(status) {
    const cleanStatus = normaliseStatus(status);

    return `<strong>${escapeHtml(cleanStatus)}</strong>`;
}

async function loginAdmin() {
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value.trim();

    loginMessage.style.color = "#ffffff";
    loginMessage.textContent = "Logging in...";

    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Login failed.");
        }

        authToken = result.token;
        adminRole = result.role;

        localStorage.setItem("adminToken", authToken);
        localStorage.setItem("adminRole", adminRole);

        loginMessage.style.color = "#4cd964";
        loginMessage.textContent = "Login successful.";

        showLoggedInInfo();
        setDashboardVisible(true);

        await refreshDashboard();

    } catch (error) {
        console.error(error);

        loginMessage.style.color = "#ff6b6b";
        loginMessage.textContent = error.message || "Login failed.";

        showToast(error.message || "Login failed.", "error");
    }
}

function showLoggedInInfo() {
    if (adminInfo) {
        adminInfo.innerHTML = `
            <h3>Logged In As: ${escapeHtml(adminRole.toUpperCase())}</h3>
        `;
    }

    if (permissionsInfo) {
        permissionsInfo.innerHTML = `
            <strong>Permissions:</strong>
            ${adminRole === "viewer"
                ? "View-only access enabled."
                : "Full recruitment management access enabled."}
        `;
    }
}

async function refreshDashboard() {
    await loadApplications();
    await loadContactMessages();
}

async function loadApplications() {
    try {
        const response = await fetch(`${API_BASE}/api/applications`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to load applications.");
        }

        allApplications = result.applications || [];

        renderApplications(allApplications);
        updateStats(allApplications);

    } catch (error) {
        console.error(error);

        if (applicationsTableBody) {
            applicationsTableBody.innerHTML = `
                <tr>
                    <td colspan="7">Failed to load applications.</td>
                </tr>
            `;
        }

        showToast(error.message || "Failed to load applications.", "error");
    }
}

function renderApplications(applications) {
    if (!applicationsTableBody) return;

    if (!applications.length) {
        applicationsTableBody.innerHTML = `
            <tr>
                <td colspan="7">No applications found.</td>
            </tr>
        `;
        return;
    }

    applicationsTableBody.innerHTML = "";

    applications.forEach(application => {
        const tr = document.createElement("tr");

        const safeId = escapeForAttribute(application.id);
        const safeName = escapeForAttribute(application.fullName);
        const safeEmail = escapeForAttribute(application.email);
        const safePosition = escapeForAttribute(application.position);
        const safePhone = escapeForAttribute(application.phone);
        const safeAddress = escapeForAttribute(application.address);
        const safeAvailability = escapeForAttribute(application.availability);
        const safeMessage = escapeForAttribute(application.message);
        const safeNotes = escapeForAttribute(application.notes);

        tr.innerHTML = `
            <td>${escapeHtml(application.fullName || "")}</td>
            <td>${escapeHtml(application.email || "")}</td>
            <td>${escapeHtml(application.position || "")}</td>
            <td>${formatDate(application.createdAt)}</td>
            <td>
                <select onchange="updateApplicationStatus('${safeId}', this.value)">
                    ${buildStatusOptions(application.status)}
                </select>
                <div>${getStatusBadge(application.status)}</div>
            </td>
            <td>
                ${application.cv
                    ? `<a href="${escapeHtml(application.cv)}" target="_blank">Download CV</a>`
                    : "No CV"}
            </td>
            <td>
                <button onclick="selectCandidate('${safeId}', '${safeName}')">
                    Interview
                </button>

                <button onclick="viewCandidate(
                    '${safeId}',
                    '${safeName}',
                    '${safeEmail}',
                    '${safePosition}',
                    '${safePhone}',
                    '${safeAddress}',
                    '${safeAvailability}',
                    '${safeMessage}',
                    '${safeNotes}'
                )">
                    View
                </button>

                <button onclick="quickRejectApplication('${safeId}')">
                    Reject
                </button>

                <button onclick="deleteApplication('${safeId}')">
                    Delete
                </button>
            </td>
        `;

        applicationsTableBody.appendChild(tr);
    });
}

function viewCandidate(id, name, email, position, phone, address, availability, message, notes) {
    selectedApplicationId = id;

    alert(
        `Candidate Profile\n\n` +
        `Name: ${name || "N/A"}\n\n` +
        `Email: ${email || "N/A"}\n\n` +
        `Phone: ${phone || "N/A"}\n\n` +
        `Position: ${position || "N/A"}\n\n` +
        `Address: ${address || "N/A"}\n\n` +
        `Availability: ${availability || "N/A"}\n\n` +
        `Application Message:\n${message || "N/A"}\n\n` +
        `Admin Notes:\n${notes || "No notes yet."}`
    );
}

function selectCandidate(id, fullName) {
    selectedApplicationId = id;

    const candidateNameInput = document.getElementById("candidateName");
    const selectedCandidateInput = document.getElementById("selectedCandidate");

    if (candidateNameInput) {
        candidateNameInput.value = fullName;
    }

    if (selectedCandidateInput) {
        selectedCandidateInput.value = fullName;
    }

    const selectedApplication = allApplications.find(app => app.id === id);

    if (selectedApplication) {
        const starRating = document.getElementById("starRating");
        const candidateNotes = document.getElementById("candidateNotes");

        if (starRating) {
            starRating.value = selectedApplication.rating || "";
        }

        if (candidateNotes) {
            candidateNotes.value = selectedApplication.notes || "";
        }
    }

    showToast(`Selected ${fullName}`, "info");
}

async function updateApplicationStatus(id, status) {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot update application status.", "error");
        await loadApplications();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/applications/${id}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                status
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to update status.");
        }

        showToast(`Application moved to ${status}.`, "success");

        await loadApplications();

    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to update status.", "error");
    }
}

async function quickRejectApplication(id) {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot reject applications.", "error");
        return;
    }

    if (!confirm("Mark this application as Rejected?")) {
        return;
    }

    await updateApplicationStatus(id, "Rejected");
}

async function deleteApplication(id) {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot delete applications.", "error");
        return;
    }

    if (!confirm("Delete this application?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/applications/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Delete failed.");
        }

        showToast("Application deleted.", "success");

        await loadApplications();

    } catch (error) {
        console.error(error);
        showToast(error.message || "Delete failed.", "error");
    }
}

async function saveCandidateNotes() {
    if (!selectedApplicationId) {
        showToast("Please select a candidate first.", "error");
        return;
    }

    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot save notes.", "error");
        return;
    }

    const rating = document.getElementById("starRating")?.value || "";
    const notes = document.getElementById("candidateNotes")?.value || "";

    try {
        const response = await fetch(`${API_BASE}/api/applications/${selectedApplicationId}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                rating,
                notes
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to save notes.");
        }

        showToast("Candidate notes saved.", "success");

        await loadApplications();

    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to save notes.", "error");
    }
}

async function sendInvitation() {
    if (!selectedApplicationId) {
        showToast("Please select a candidate first.", "error");
        return;
    }

    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot send invitations.", "error");
        return;
    }

    const sendInvitationBtn = document.getElementById("sendInvitationBtn");

    if (sendInvitationBtn) {
        sendInvitationBtn.disabled = true;
        sendInvitationBtn.textContent = "Sending...";
    }

    try {
        const payload = {
            interviewDate: document.getElementById("interviewDate")?.value || "",
            interviewTime: document.getElementById("interviewTime")?.value || "",
            interviewLocation: document.getElementById("interviewLocation")?.value || "",
            interviewMessage: document.getElementById("interviewMessage")?.value || ""
        };

        const response = await fetch(
            `${API_BASE}/api/applications/${selectedApplicationId}/invite`,
            {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Invitation failed.");
        }

        showToast("Interview invitation sent successfully.", "success");

        await loadApplications();

    } catch (error) {
        console.error(error);
        showToast(error.message || "Invitation failed.", "error");
    } finally {
        if (sendInvitationBtn) {
            sendInvitationBtn.disabled = false;
            sendInvitationBtn.textContent = "Send Invitation";
        }
    }
}

async function loadContactMessages() {
    try {
        const response = await fetch(`${API_BASE}/api/contact-messages`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to load contact messages.");
        }

        allContactMessages = result.messages || [];

        renderContactMessages(allContactMessages);

    } catch (error) {
        console.error(error);

        if (contactMessagesTableBody) {
            contactMessagesTableBody.innerHTML = `
                <tr>
                    <td colspan="7">Failed to load contact messages.</td>
                </tr>
            `;
        }

        showToast(error.message || "Failed to load contact messages.", "error");
    }
}

function renderContactMessages(messages) {
    if (!contactMessagesTableBody) return;

    if (!messages.length) {
        contactMessagesTableBody.innerHTML = `
            <tr>
                <td colspan="7">No contact messages found.</td>
            </tr>
        `;
        return;
    }

    contactMessagesTableBody.innerHTML = "";

    messages.forEach(message => {
        const tr = document.createElement("tr");

        const safeId = escapeForAttribute(message.id);
        const safeName = escapeForAttribute(message.name);
        const safeEmail = escapeForAttribute(message.email);
        const safeSubject = escapeForAttribute(message.subject);
        const safeMessage = escapeForAttribute(message.message);
        const safePhone = escapeForAttribute(message.phone);

        tr.innerHTML = `
            <td>${escapeHtml(message.name || "")}</td>
            <td>${escapeHtml(message.email || "")}</td>
            <td>${escapeHtml(message.phone || "")}</td>
            <td>${escapeHtml(message.subject || "")}</td>
            <td>${formatDate(message.createdAt)}</td>
            <td>${message.read ? "Read" : "New"}</td>
            <td>
                <button onclick="viewContactMessage(
                    '${safeId}',
                    '${safeName}',
                    '${safeEmail}',
                    '${safePhone}',
                    '${safeSubject}',
                    '${safeMessage}'
                )">
                    View
                </button>

                <button onclick="markMessageRead('${safeId}')">
                    Mark Read
                </button>

                <button onclick="deleteContactMessage('${safeId}')">
                    Delete
                </button>
            </td>
        `;

        contactMessagesTableBody.appendChild(tr);
    });
}

function viewContactMessage(id, name, email, phone, subject, message) {
    selectedContactMessageId = id;

    alert(
        `Contact Message\n\n` +
        `Name: ${name || "N/A"}\n\n` +
        `Email: ${email || "N/A"}\n\n` +
        `Phone: ${phone || "N/A"}\n\n` +
        `Subject: ${subject || "N/A"}\n\n` +
        `Message:\n${message || "N/A"}`
    );
}

async function markMessageRead(id) {
    try {
        const response = await fetch(`${API_BASE}/api/contact-messages/${id}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                read: true,
                status: "Read"
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to update message.");
        }

        showToast("Message marked as read.", "success");

        await loadContactMessages();

    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to update message.", "error");
    }
}

async function deleteContactMessage(id) {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot delete messages.", "error");
        return;
    }

    if (!confirm("Delete this contact message?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/contact-messages/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to delete message.");
        }

        showToast("Contact message deleted.", "success");

        await loadContactMessages();

    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to delete message.", "error");
    }
}

function updateStats(applications) {
    const total = applications.length;

    const newCount = applications.filter(app =>
        normaliseStatus(app.status).toLowerCase() === "new"
    ).length;

    const interviewCount = applications.filter(app =>
        normaliseStatus(app.status).toLowerCase().includes("interview")
    ).length;

    const hiredCount = applications.filter(app =>
        normaliseStatus(app.status).toLowerCase() === "hired"
    ).length;

    const rejectedCount = applications.filter(app =>
        normaliseStatus(app.status).toLowerCase() === "rejected"
    ).length;

    const roles = new Set(
        applications
            .map(app => app.position || "")
            .filter(Boolean)
    );

    const statuses = new Set(
        applications
            .map(app => normaliseStatus(app.status))
            .filter(Boolean)
    );

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thisWeekCount = applications.filter(app => {
        if (!app.createdAt) return false;
        const date = new Date(app.createdAt);
        return !Number.isNaN(date.getTime()) && date >= sevenDaysAgo;
    }).length;

    if (totalApplications) totalApplications.textContent = total;
    if (newApplications) newApplications.textContent = newCount;
    if (interviewApplications) interviewApplications.textContent = interviewCount;
    if (hiredApplications) hiredApplications.textContent = hiredCount;

    if (applicationsByRole) applicationsByRole.textContent = roles.size;
    if (statusBreakdown) statusBreakdown.textContent = statuses.size;
    if (newThisWeek) newThisWeek.textContent = thisWeekCount;
    if (interviewPipeline) interviewPipeline.textContent = interviewCount;

    const stats = document.getElementById("stats");

    if (stats) {
        stats.innerHTML = `
            <p>
                ATS Summary:
                ${total} total applications,
                ${newCount} new,
                ${interviewCount} in interview,
                ${hiredCount} hired,
                ${rejectedCount} rejected.
            </p>
        `;
    }
}

function exportApplicationsCSV() {
    showToast("CSV export started.", "info");

    const rows = allApplications.map(application => {
        return [
            application.fullName || "",
            application.email || "",
            application.position || "",
            formatDate(application.createdAt),
            normaliseStatus(application.status),
            application.rating || "",
            application.notes || ""
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = [
        `"Name","Email","Position","Date Applied","Status","Rating","Notes"`,
        ...rows
    ].join("\n");

    const blob = new Blob([csvContent], {
        type: "text/csv"
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "applications.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

function logoutAdmin() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");

    authToken = "";
    adminRole = "";
    selectedApplicationId = null;
    selectedContactMessageId = null;
    allApplications = [];
    allContactMessages = [];

    setDashboardVisible(false);

    showToast("Logged out successfully.", "success");
}

document.getElementById("sendInvitationBtn")?.addEventListener("click", sendInvitation);
document.getElementById("logoutBtn")?.addEventListener("click", logoutAdmin);
document.getElementById("exportCsvBtn")?.addEventListener("click", exportApplicationsCSV);
document.getElementById("saveNotesBtn")?.addEventListener("click", saveCandidateNotes);

window.loginAdmin = loginAdmin;
window.deleteApplication = deleteApplication;
window.selectCandidate = selectCandidate;
window.viewCandidate = viewCandidate;
window.updateApplicationStatus = updateApplicationStatus;
window.quickRejectApplication = quickRejectApplication;
window.deleteContactMessage = deleteContactMessage;
window.markMessageRead = markMessageRead;
window.viewContactMessage = viewContactMessage;

if (authToken) {
    setDashboardVisible(true);
    showLoggedInInfo();
    refreshDashboard();
}