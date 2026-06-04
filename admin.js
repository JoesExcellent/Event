const API_BASE = "";

let authToken = localStorage.getItem("adminToken") || "";
let adminRole = localStorage.getItem("adminRole") || "";
let selectedApplicationId = null;
let selectedContactMessageId = null;
let modalApplicationId = null;
let autoRefreshTimer = null;

let allApplications = [];
let allContactMessages = [];
let allVacancies = [];
let selectedVacancyId = null;

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

const loginBox = document.getElementById("loginBox");
const dashboardContent = document.getElementById("dashboardContent");
const loginMessage = document.getElementById("loginMessage");
const adminInfo = document.getElementById("adminInfo");
const permissionsInfo = document.getElementById("permissionsInfo");

const applicationsTableBody = document.getElementById("applicationsTableBody");
const contactMessagesTableBody = document.getElementById("contactMessagesTableBody");
const communicationTableBody = document.getElementById("communicationTableBody");
const vacanciesTableBody = document.getElementById("vacanciesTableBody");
const vacancyMessage = document.getElementById("vacancyMessage");

const totalApplications = document.getElementById("totalApplications");
const newApplications = document.getElementById("newApplications");
const interviewApplications = document.getElementById("interviewApplications");
const hiredApplications = document.getElementById("hiredApplications");

const applicationsByRole = document.getElementById("applicationsByRole");
const statusBreakdown = document.getElementById("statusBreakdown");
const newThisWeek = document.getElementById("newThisWeek");
const interviewPipeline = document.getElementById("interviewPipeline");

const unreadMessagesCount = document.getElementById("unreadMessagesCount");
const pendingInterviewsCount = document.getElementById("pendingInterviewsCount");
const offerStageCount = document.getElementById("offerStageCount");
const followUpsCount = document.getElementById("followUpsCount");

const candidateActivityFeed = document.getElementById("candidateActivityFeed");
const recruiterTaskList = document.getElementById("recruiterTaskList");
const lastRefreshInfo = document.getElementById("lastRefreshInfo");

const candidateSearchInput = document.getElementById("candidateSearchInput");
const statusFilterSelect = document.getElementById("statusFilterSelect");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const manualRefreshBtn = document.getElementById("manualRefreshBtn");

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
    if (loginBox) loginBox.style.display = show ? "none" : "block";
    if (dashboardContent) dashboardContent.style.display = show ? "block" : "none";
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

function escapeQuotes(value) {
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

function getStatusClass(status) {
    return "status-" + normaliseStatus(status)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function buildStatusBadge(status) {
    const safeStatus = normaliseStatus(status);
    return `<span class="ats-status-badge ${getStatusClass(safeStatus)}">${escapeHtml(safeStatus)}</span>`;
}

function buildStatusOptions(currentStatus) {
    const activeStatus = normaliseStatus(currentStatus);

    return ATS_STATUSES.map(status => {
        const selected = status === activeStatus ? "selected" : "";
        return `<option value="${escapeHtml(status)}" ${selected}>${escapeHtml(status)}</option>`;
    }).join("");
}

function calculateATSScore(application) {
    let score = 0;

    if (application.fullName) score += 10;
    if (application.email) score += 10;
    if (application.phone) score += 10;
    if (application.position) score += 10;
    if (application.availability) score += 10;
    if (application.message && application.message.length > 20) score += 15;
    if (application.cv) score += 15;
    if (application.rating) score += Number(application.rating) * 4;

    return Math.min(score, 100);
}

function showLoggedInInfo() {
    if (adminInfo) {
        adminInfo.innerHTML = `<h3>Logged In As: ${escapeHtml(adminRole.toUpperCase())}</h3>`;
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

async function loginAdmin() {
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value.trim();

    loginMessage.style.color = "#ffffff";
    loginMessage.textContent = "Logging in...";

    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
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
        startAutoRefresh();

    } catch (error) {
        console.error(error);
        loginMessage.style.color = "#ff6b6b";
        loginMessage.textContent = error.message || "Login failed.";
        showToast(error.message || "Login failed.", "error");
    }
}

async function refreshDashboard(showMessage = false) {
    await loadApplications();
    await loadContactMessages();
    await loadVacancies();

    updateCommandCentre();
    renderActivityFeed();
    renderRecruiterTasks();
    renderCommunicationCentre();
    updateLastRefreshTime();

    if (showMessage) {
        showToast("Dashboard refreshed.", "success");
    }
}

function startAutoRefresh() {
    stopAutoRefresh();

    autoRefreshTimer = setInterval(async () => {
        if (authToken) {
            await refreshDashboard(false);
        }
    }, 60000);
}

function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
}

function updateLastRefreshTime() {
    if (!lastRefreshInfo) return;

    const now = new Date();

    lastRefreshInfo.textContent = `Dashboard last refreshed at ${now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    })}. Auto-refresh is active.`;
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
        applyCandidateFilters();

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

function getFilteredApplications() {
    const searchValue = candidateSearchInput
        ? candidateSearchInput.value.trim().toLowerCase()
        : "";

    const statusValue = statusFilterSelect
        ? statusFilterSelect.value.trim().toLowerCase()
        : "";

    return allApplications.filter(application => {
        const status = normaliseStatus(application.status).toLowerCase();

        const searchableText = [
            application.fullName,
            application.email,
            application.phone,
            application.address,
            application.position,
            application.availability,
            application.message,
            application.notes,
            status
        ].join(" ").toLowerCase();

        const matchesSearch = !searchValue || searchableText.includes(searchValue);
        const matchesStatus = !statusValue || status === statusValue;

        return matchesSearch && matchesStatus;
    });
}

function applyCandidateFilters() {
    const filteredApplications = getFilteredApplications();

    renderApplications(filteredApplications);
    updateStats(filteredApplications);

    const stats = document.getElementById("stats");

    if (stats) {
        stats.innerHTML += `
            <p>
                Showing ${filteredApplications.length} of ${allApplications.length} candidate records.
            </p>
        `;
    }
}

function clearCandidateFilters() {
    if (candidateSearchInput) candidateSearchInput.value = "";
    if (statusFilterSelect) statusFilterSelect.value = "";

    applyCandidateFilters();
    showToast("Candidate filters cleared.", "info");
}

function renderApplications(applications) {
    if (!applicationsTableBody) return;

    if (!applications.length) {
        applicationsTableBody.innerHTML = `
            <tr>
                <td colspan="7">No matching applications found.</td>
            </tr>
        `;
        return;
    }

    applicationsTableBody.innerHTML = "";

    applications.forEach(application => {
        const tr = document.createElement("tr");

        const id = escapeQuotes(application.id);
        const fullName = escapeQuotes(application.fullName);

        tr.innerHTML = `
            <td>${escapeHtml(application.fullName || "")}</td>
            <td>${escapeHtml(application.email || "")}</td>
            <td>${escapeHtml(application.position || "")}</td>
            <td>${formatDate(application.createdAt)}</td>
            <td>
                <select onchange="updateApplicationStatus('${id}', this.value)">
                    ${buildStatusOptions(application.status)}
                </select>
                ${buildStatusBadge(application.status)}
            </td>
            <td>
                ${application.cv
                    ? `<a href="${escapeHtml(application.cv)}" target="_blank">Download CV</a>`
                    : "No CV"}
            </td>
            <td>
                <button onclick="selectCandidate('${id}', '${fullName}')">Interview</button>
                <button onclick="openCandidateModal('${id}')">View</button>
                <button onclick="sendOfferEmail('${id}')">Offer Job</button>
                <button onclick="markCandidateHired('${id}')">Mark Hired</button>
                <button onclick="quickRejectApplication('${id}')">Reject</button>
                <button onclick="deleteApplication('${id}')">Delete</button>
            </td>
        `;

        applicationsTableBody.appendChild(tr);
    });
}

function openCandidateModal(id) {
    const application = allApplications.find(app => app.id === id);

    if (!application) {
        showToast("Candidate record could not be found.", "error");
        return;
    }

    modalApplicationId = id;
    selectedApplicationId = id;

    const status = normaliseStatus(application.status);
    const score = calculateATSScore(application);
    const rating = application.rating || "0";

    document.getElementById("modalCandidateName").textContent = application.fullName || "Candidate Profile";
    document.getElementById("modalCandidateEmail").textContent = application.email || "N/A";
    document.getElementById("modalCandidatePhone").textContent = application.phone || "N/A";
    document.getElementById("modalCandidateAddress").textContent = application.address || "N/A";
    document.getElementById("modalCandidatePosition").textContent = application.position || "N/A";
    document.getElementById("modalCandidateAvailability").textContent = application.availability || "N/A";
    document.getElementById("modalCandidateDate").textContent = formatDate(application.createdAt);
    document.getElementById("modalCandidateRating").textContent = rating;
    document.getElementById("modalCandidateScore").textContent = `${score}%`;
    document.getElementById("modalCandidateStage").textContent = status;
    document.getElementById("modalCandidateMessage").textContent = application.message || "No application message available.";
    document.getElementById("modalCandidateNotes").textContent = application.notes || "No recruiter notes have been saved yet.";

    const modalStatus = document.getElementById("modalCandidateStatus");
    modalStatus.textContent = status;
    modalStatus.className = `ats-status-badge ${getStatusClass(status)}`;

    renderCandidateTimeline(application);
    renderCandidateCommunicationTimeline(application);

    const modal = document.getElementById("candidateProfileModal");

    if (modal) {
        modal.classList.add("active");
    }
}

function closeCandidateModal() {
    const modal = document.getElementById("candidateProfileModal");

    if (modal) {
        modal.classList.remove("active");
    }
}

function renderCandidateTimeline(application) {
    const timeline = document.getElementById("modalCandidateTimeline");

    if (!timeline) return;

    const status = normaliseStatus(application.status);

    const items = [
        {
            title: "Application Received",
            text: `Candidate entered the recruitment pipeline on ${formatDate(application.createdAt)}.`
        }
    ];

    if (application.cv) {
        items.push({
            title: "CV Uploaded",
            text: "Candidate provided a CV with their application."
        });
    }

    if (application.updatedAt) {
        items.push({
            title: "Record Updated",
            text: `Candidate record was last updated on ${formatDateTime(application.updatedAt)}.`
        });
    }

    if (application.invitationSent || status.includes("Interview")) {
        items.push({
            title: "Interview Stage",
            text: application.invitationSentAt
                ? `Interview invitation sent on ${formatDateTime(application.invitationSentAt)}.`
                : "Candidate has entered the interview stage."
        });
    }

    if (application.interviewDate || application.interviewTime || application.interviewLocation) {
        items.push({
            title: "Interview Details",
            text: `Date: ${application.interviewDate || "N/A"} | Time: ${application.interviewTime || "N/A"} | Location: ${application.interviewLocation || "N/A"}`
        });
    }

    if (status === "Offer Made") {
        items.push({ title: "Offer Made", text: "Candidate has reached offer stage." });
    }

    if (status === "Hired") {
        items.push({ title: "Candidate Hired", text: "Candidate has been marked as hired." });
    }

    if (status === "Rejected") {
        items.push({ title: "Candidate Rejected", text: "Candidate has been marked as rejected." });
    }

    timeline.innerHTML = items.map(item => `
        <li>
            <strong>${escapeHtml(item.title)}</strong>
            ${escapeHtml(item.text)}
        </li>
    `).join("");
}

function renderCandidateCommunicationTimeline(application) {
    const timeline = document.getElementById("modalCandidateCommunicationTimeline");

    if (!timeline) return;

    const items = [];

    if (application.invitationSent) {
        items.push({
            title: "Interview Invitation Sent",
            text: application.invitationSentAt
                ? `Email sent on ${formatDateTime(application.invitationSentAt)}.`
                : "Interview invitation email has been sent."
        });
    }

    if (application.invitationEmailId) {
        items.push({
            title: "Interview Invitation Delivery Reference",
            text: `Resend Email ID: ${application.invitationEmailId}`
        });
    }

    if (application.reminderSent) {
        items.push({
            title: "Interview Reminder Sent",
            text: application.reminderSentAt
                ? `Email sent on ${formatDateTime(application.reminderSentAt)}.`
                : "Interview reminder email has been sent."
        });
    }

    if (application.reminderEmailId) {
        items.push({
            title: "Interview Reminder Delivery Reference",
            text: `Resend Email ID: ${application.reminderEmailId}`
        });
    }

    if (!items.length) {
        items.push({
            title: "No Email Activity Yet",
            text: "No interview invitation or interview reminder has been recorded for this candidate yet."
        });
    }

    timeline.innerHTML = items.map(item => `
        <li>
            <strong>${escapeHtml(item.title)}</strong>
            ${escapeHtml(item.text)}
        </li>
    `).join("");
}

function selectCandidate(id, fullName) {
    selectedApplicationId = id;

    const candidateNameInput = document.getElementById("candidateName");
    const selectedCandidateInput = document.getElementById("selectedCandidate");
    const starRating = document.getElementById("starRating");
    const candidateNotes = document.getElementById("candidateNotes");

    if (candidateNameInput) candidateNameInput.value = fullName || "";
    if (selectedCandidateInput) selectedCandidateInput.value = fullName || "";

    const selectedApplication = allApplications.find(app => app.id === id);

    if (selectedApplication) {
        if (starRating) starRating.value = selectedApplication.rating || "";
        if (candidateNotes) candidateNotes.value = selectedApplication.notes || "";
    }

    showToast(`Selected ${fullName}`, "info");
}

function selectCandidateFromModal() {
    if (!modalApplicationId) {
        showToast("No candidate selected.", "error");
        return;
    }

    const application = allApplications.find(app => app.id === modalApplicationId);

    if (!application) {
        showToast("Candidate record could not be found.", "error");
        return;
    }

    selectCandidate(application.id, application.fullName || "Candidate");
    closeCandidateModal();
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
            body: JSON.stringify({ status })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to update status.");
        }

        showToast(`Application moved to ${status}.`, "success");

        await refreshDashboard();

        if (modalApplicationId === id) {
            openCandidateModal(id);
        }

    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to update status.", "error");
    }
}

async function moveModalCandidateToShortlist() {
    if (modalApplicationId) await updateApplicationStatus(modalApplicationId, "Shortlisted");
}

async function moveModalCandidateToOffer() {
    if (modalApplicationId) await updateApplicationStatus(modalApplicationId, "Offer Made");
}

async function moveModalCandidateToHired() {
    if (!modalApplicationId) {
        showToast("Please open a candidate first.", "error");
        return;
    }

    await markCandidateHired(modalApplicationId);
}


async function moveModalCandidateToRejected() {
    if (modalApplicationId) await updateApplicationStatus(modalApplicationId, "Rejected");
}


async function sendOfferFromModal() {
    if (!modalApplicationId) {
        showToast("Please open a candidate first.", "error");
        return;
    }

    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot send offer emails.", "error");
        return;
    }

    if (!confirm("Send an offer email to this candidate?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/applications/${modalApplicationId}/offer`, {
            method: "POST",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Offer email failed.");
        }

        showToast("Offer email sent successfully.", "success");
        await refreshDashboard();
        openCandidateModal(modalApplicationId);

    } catch (error) {
        console.error(error);
        showToast(error.message || "Offer email failed.", "error");
    }
}


async function markCandidateHired(id) {
    if (!id) {
        showToast("Candidate could not be found.", "error");
        return;
    }

    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot mark candidates as hired.", "error");
        return;
    }

    const application = allApplications.find(app => app.id === id);
    const candidateName = application?.fullName || "this candidate";

    if (!confirm(`Mark ${candidateName} as hired?`)) {
        return;
    }

    const now = new Date().toISOString();

    try {
        const response = await fetch(`${API_BASE}/api/admin/applications/${id}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                status: "Hired",
                hiredAt: now,
                lastCommunicationAction: "Marked Hired",
                lastCommunicationAt: now
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to mark candidate as hired.");
        }

        showToast(`${candidateName} marked as Hired.`, "success");
        await refreshDashboard();

        if (modalApplicationId === id) {
            openCandidateModal(id);
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to mark candidate as hired.", "error");
    }
}

async function sendOfferEmail(id) {
    if (!id) {
        showToast("Candidate could not be found.", "error");
        return;
    }

    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot send offer emails.", "error");
        return;
    }

    const application = allApplications.find(app => app.id === id);
    const candidateName = application?.fullName || "this candidate";

    if (!confirm(`Send an offer email to ${candidateName}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/applications/${id}/offer`, {
            method: "POST",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Offer email failed.");
        }

        showToast("Offer email sent successfully.", "success");
        await refreshDashboard();

        if (modalApplicationId === id) {
            openCandidateModal(id);
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || "Offer email failed.", "error");
    }
}

async function sendRejectionFromModal() {
    if (!modalApplicationId) {
        showToast("Please open a candidate first.", "error");
        return;
    }

    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot send rejection emails.", "error");
        return;
    }

    if (!confirm("Send a rejection email to this candidate?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/applications/${modalApplicationId}/rejection`, {
            method: "POST",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Rejection email failed.");
        }

        showToast("Rejection email sent successfully.", "success");
        await refreshDashboard();
        openCandidateModal(modalApplicationId);

    } catch (error) {
        console.error(error);
        showToast(error.message || "Rejection email failed.", "error");
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
            body: JSON.stringify({ rating, notes })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to save notes.");
        }

        showToast("Candidate notes saved.", "success");

        await refreshDashboard();

        if (modalApplicationId === selectedApplicationId) {
            openCandidateModal(selectedApplicationId);
        }

    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to save notes.", "error");
    }
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

        if (modalApplicationId === id) {
            closeCandidateModal();
            modalApplicationId = null;
        }

        await refreshDashboard();

    } catch (error) {
        console.error(error);
        showToast(error.message || "Delete failed.", "error");
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

        await refreshDashboard();

        if (modalApplicationId === selectedApplicationId) {
            openCandidateModal(selectedApplicationId);
        }

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


const reminderTemplates = {
    "7day": {
        buttonText: "7 Day Reminder",
        sendingText: "Sending 7 Day Reminder...",
        successText: "7 Day reminder sent successfully.",
        message: `Dear {{candidateName}},

This is a friendly reminder that your interview for the position of {{position}} with Joe's Excellent Events & Management is scheduled to take place in 7 days.

Interview Details

Date: {{interviewDate}}
Time: {{interviewTime}}
Location: {{interviewLocation}}

Please contact us if you require any adjustments, have any questions, or need to rearrange.

We look forward to meeting you.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`
    },

    "24hour": {
        buttonText: "24 Hour Reminder",
        sendingText: "Sending 24 Hour Reminder...",
        successText: "24 Hour reminder sent successfully.",
        message: `Dear {{candidateName}},

This is a reminder that your interview for the position of {{position}} with Joe's Excellent Events & Management is scheduled to take place tomorrow.

Interview Details

Date: {{interviewDate}}
Time: {{interviewTime}}
Location: {{interviewLocation}}

Please arrive promptly and bring any documents or information requested during the recruitment process.

If you need assistance or need to contact us before your interview, please do so as soon as possible.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`
    },

    "sameday": {
        buttonText: "Same Day Reminder",
        sendingText: "Sending Same Day Reminder...",
        successText: "Same Day reminder sent successfully.",
        message: `Dear {{candidateName}},

This is a reminder that your interview for the position of {{position}} with Joe's Excellent Events & Management is scheduled to take place today.

Interview Details

Time: {{interviewTime}}
Location: {{interviewLocation}}

Please aim to arrive 10-15 minutes early where possible.

We wish you every success and look forward to meeting you.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`
    }
};


async function sendReminder(reminderType = "7day", reminderButton = null) {
    if (!selectedApplicationId) {
        showToast("Please select a candidate first.", "error");
        return;
    }

    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot send reminders.", "error");
        return;
    }

    const reminderConfig = reminderTemplates[reminderType];

    if (!reminderConfig) {
        showToast("Unknown reminder type selected.", "error");
        return;
    }

    const interviewMessageField = document.getElementById("interviewMessage");

    if (interviewMessageField) {
        interviewMessageField.value = reminderConfig.message;
    }

    if (reminderButton) {
        reminderButton.disabled = true;
        reminderButton.textContent = reminderConfig.sendingText;
    }

    try {
        const payload = {
            reminderType,
            interviewDate: document.getElementById("interviewDate")?.value || "",
            interviewTime: document.getElementById("interviewTime")?.value || "",
            interviewLocation: document.getElementById("interviewLocation")?.value || "",
            interviewMessage: interviewMessageField?.value || reminderConfig.message
        };

        const response = await fetch(
            `${API_BASE}/api/applications/${selectedApplicationId}/reminder`,
            {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Reminder failed.");
        }

        showToast(result.message || reminderConfig.successText, "success");

        await refreshDashboard();

        if (modalApplicationId === selectedApplicationId) {
            openCandidateModal(selectedApplicationId);
        }

    } catch (error) {
        console.error(error);
        showToast(error.message || "Reminder failed.", "error");
    } finally {
        if (reminderButton) {
            reminderButton.disabled = false;
            reminderButton.textContent = reminderConfig.buttonText;
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

        const id = escapeQuotes(message.id);
        const name = escapeQuotes(message.name);
        const email = escapeQuotes(message.email);
        const phone = escapeQuotes(message.phone);
        const subject = escapeQuotes(message.subject);
        const text = escapeQuotes(message.message);

        tr.innerHTML = `
            <td>${escapeHtml(message.name || "")}</td>
            <td>${escapeHtml(message.email || "")}</td>
            <td>${escapeHtml(message.phone || "")}</td>
            <td>${escapeHtml(message.subject || "")}</td>
            <td>${formatDate(message.createdAt)}</td>
            <td>${message.read ? "Read" : "New"}</td>
            <td>
                <button onclick="viewContactMessage('${id}', '${name}', '${email}', '${phone}', '${subject}', '${text}')">View</button>
                <button onclick="markMessageRead('${id}')">Mark Read</button>
                <button onclick="deleteContactMessage('${id}')">Delete</button>
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
        await refreshDashboard();

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
        await refreshDashboard();

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

    const weekCount = applications.filter(app => {
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
    if (newThisWeek) newThisWeek.textContent = weekCount;
    if (interviewPipeline) interviewPipeline.textContent = interviewCount;

    const stats = document.getElementById("stats");

    if (stats) {
        stats.innerHTML = `
            <p>
                ATS Summary:
                ${total} visible applications,
                ${newCount} new,
                ${interviewCount} in interview,
                ${hiredCount} hired.
            </p>
        `;
    }
}

function updateCommandCentre() {
    const unread = allContactMessages.filter(message => !message.read).length;

    const pendingInterviews = allApplications.filter(app =>
        normaliseStatus(app.status).toLowerCase().includes("interview") &&
        normaliseStatus(app.status) !== "Interview Completed"
    ).length;

    const offers = allApplications.filter(app =>
        normaliseStatus(app.status) === "Offer Made"
    ).length;

    const followUps = allApplications.filter(app =>
        normaliseStatus(app.status) === "New" ||
        normaliseStatus(app.status) === "Screening" ||
        normaliseStatus(app.status) === "Shortlisted"
    ).length;

    if (unreadMessagesCount) unreadMessagesCount.textContent = unread;
    if (pendingInterviewsCount) pendingInterviewsCount.textContent = pendingInterviews;
    if (offerStageCount) offerStageCount.textContent = offers;
    if (followUpsCount) followUpsCount.textContent = followUps;
}

function renderActivityFeed() {
    if (!candidateActivityFeed) return;

    const activities = [];

    allApplications
        .slice()
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, 8)
        .forEach(app => {
            activities.push({
                title: `${app.fullName || "Candidate"} - ${normaliseStatus(app.status)}`,
                text: `Role: ${app.position || "N/A"} | Updated: ${formatDateTime(app.updatedAt || app.createdAt)}`
            });
        });

    if (!activities.length) {
        activities.push({
            title: "No Candidate Activity",
            text: "Candidate activity will appear once applications are received."
        });
    }

    candidateActivityFeed.innerHTML = activities.map(item => `
        <li>
            <strong>${escapeHtml(item.title)}</strong>
            ${escapeHtml(item.text)}
        </li>
    `).join("");
}

function renderRecruiterTasks() {
    if (!recruiterTaskList) return;

    const tasks = [];

    allContactMessages
        .filter(message => !message.read)
        .slice(0, 5)
        .forEach(message => {
            tasks.push({
                title: "Unread Contact Message",
                text: `${message.name || "Website visitor"} sent: ${message.subject || "No subject"}`
            });
        });

    allApplications
        .filter(app => normaliseStatus(app.status) === "New")
        .slice(0, 5)
        .forEach(app => {
            tasks.push({
                title: "Review New Application",
                text: `${app.fullName || "Candidate"} applied for ${app.position || "a role"}.`
            });
        });

    allApplications
        .filter(app => normaliseStatus(app.status) === "Interview Invited" && !app.interviewDate)
        .slice(0, 5)
        .forEach(app => {
            tasks.push({
                title: "Confirm Interview Details",
                text: `${app.fullName || "Candidate"} has been invited but interview details may need checking.`
            });
        });

    if (!tasks.length) {
        tasks.push({
            title: "No Urgent Tasks",
            text: "There are no urgent recruiter actions at this time."
        });
    }

    recruiterTaskList.innerHTML = tasks.map(item => `
        <li>
            <strong>${escapeHtml(item.title)}</strong>
            ${escapeHtml(item.text)}
        </li>
    `).join("");
}

function renderCommunicationCentre() {
    if (!communicationTableBody) return;

    const communicationRecords = allApplications.filter(app =>
        app.email || app.invitationSent || app.invitationEmailId
    );

    if (!communicationRecords.length) {
        communicationTableBody.innerHTML = `
            <tr>
                <td colspan="5">No communication records found.</td>
            </tr>
        `;
        return;
    }

    communicationTableBody.innerHTML = "";

    communicationRecords.forEach(app => {
        const needsFollowUp =
            normaliseStatus(app.status) === "New" ||
            normaliseStatus(app.status) === "Screening" ||
            normaliseStatus(app.status) === "Shortlisted";

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${escapeHtml(app.fullName || "Candidate")}</td>
            <td>${escapeHtml(app.email || "N/A")}</td>
            <td>${app.invitationSent ? "Yes" : "No"}</td>
            <td>${escapeHtml(app.invitationEmailId || "N/A")}</td>
            <td>${needsFollowUp ? "Follow up required" : "No urgent follow-up"}</td>
        `;

        communicationTableBody.appendChild(tr);
    });
}

function exportApplicationsCSV() {
    showToast("CSV export started.", "info");

    const applicationsToExport = getFilteredApplications();

    const rows = applicationsToExport.map(application => {
        return [
            application.fullName || "",
            application.email || "",
            application.position || "",
            formatDate(application.createdAt),
            normaliseStatus(application.status),
            application.rating || "",
            calculateATSScore(application),
            application.notes || ""
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = [
        `"Name","Email","Position","Date Applied","Status","Rating","ATS Score","Notes"`,
        ...rows
    ].join("\n");

    const blob = new Blob([csvContent], {
        type: "text/csv"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "filtered-applications.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}


function getVacancyFormData() {
    return {
        title: document.getElementById("vacancyTitle")?.value.trim() || "",
        location: document.getElementById("vacancyLocation")?.value.trim() || "",
        type: document.getElementById("vacancyType")?.value || "",
        category: document.getElementById("vacancyCategory")?.value || "General",
        salaryMin: document.getElementById("vacancySalaryMin")?.value.trim() || "",
        salaryMax: document.getElementById("vacancySalaryMax")?.value.trim() || "",
        closingDate: document.getElementById("vacancyClosingDate")?.value || "",
        status: document.getElementById("vacancyStatus")?.value || "Draft",
        description: document.getElementById("vacancyDescription")?.value.trim() || "",
        responsibilities: document.getElementById("vacancyResponsibilities")?.value || "",
        requirements: document.getElementById("vacancyRequirements")?.value || ""
    };
}

function setVacancyMessage(message, isError = false) {
    if (!vacancyMessage) return;
    vacancyMessage.textContent = message;
    vacancyMessage.style.color = isError ? "#ff6b6b" : "#ff6a00";
    vacancyMessage.style.fontWeight = "700";
    vacancyMessage.style.marginTop = "14px";
}

function clearVacancyForm() {
    selectedVacancyId = null;

    [
        "vacancyTitle",
        "vacancyLocation",
        "vacancySalaryMin",
        "vacancySalaryMax",
        "vacancyClosingDate",
        "vacancyDescription",
        "vacancyResponsibilities",
        "vacancyRequirements"
    ].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = "";
    });

    const type = document.getElementById("vacancyType");
    const category = document.getElementById("vacancyCategory");
    const status = document.getElementById("vacancyStatus");

    if (type) type.value = "";
    if (category) category.value = "";
    if (status) status.value = "Draft";

    setVacancyMessage("Vacancy form cleared.");
}

function salaryText(vacancy) {
    if (vacancy.salaryMin && vacancy.salaryMax) return `${vacancy.salaryMin} – ${vacancy.salaryMax}`;
    return vacancy.salaryMin || vacancy.salaryMax || "N/A";
}

async function loadVacancies() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/vacancies`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to load vacancies.");
        }

        allVacancies = result.vacancies || [];
        renderVacancies(allVacancies);
    } catch (error) {
        console.error(error);

        if (vacanciesTableBody) {
            vacanciesTableBody.innerHTML = `
                <tr>
                    <td colspan="7">Failed to load vacancies.</td>
                </tr>
            `;
        }

        showToast(error.message || "Failed to load vacancies.", "error");
    }
}

function renderVacancies(vacancies) {
    if (!vacanciesTableBody) return;

    if (!vacancies.length) {
        vacanciesTableBody.innerHTML = `
            <tr>
                <td colspan="7">No vacancies have been created yet.</td>
            </tr>
        `;
        return;
    }

    vacanciesTableBody.innerHTML = "";

    vacancies.forEach(vacancy => {
        const tr = document.createElement("tr");
        const id = escapeQuotes(vacancy.id);

        tr.innerHTML = `
            <td>${escapeHtml(vacancy.title || "")}</td>
            <td>${escapeHtml(vacancy.category || "General")}</td>
            <td>${escapeHtml(vacancy.location || "")}</td>
            <td>${escapeHtml(salaryText(vacancy))}</td>
            <td>${escapeHtml(vacancy.status || "Draft")}</td>
            <td>${vacancy.closingDate ? formatDate(vacancy.closingDate) : "N/A"}</td>
            <td>
                <button onclick="editVacancy('${id}')">Edit</button>
                <button onclick="setVacancyStatus('${id}', 'Draft')">Draft</button>
                <button onclick="setVacancyStatus('${id}', 'Published')">Publish</button>
                <button onclick="setVacancyStatus('${id}', 'Closed')">Close</button>
                <button onclick="deleteVacancy('${id}')">Delete</button>
            </td>
        `;

        vacanciesTableBody.appendChild(tr);
    });
}

async function createVacancy() {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot create vacancies.", "error");
        return;
    }

    const payload = getVacancyFormData();

    if (!payload.title) {
        setVacancyMessage("Please enter a job title before creating a vacancy.", true);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/vacancies`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to create vacancy.");
        }

        selectedVacancyId = result.id;
        setVacancyMessage("Vacancy created successfully.");
        showToast("Vacancy created successfully.", "success");
        await loadVacancies();
    } catch (error) {
        console.error(error);
        setVacancyMessage(error.message || "Failed to create vacancy.", true);
        showToast(error.message || "Failed to create vacancy.", "error");
    }
}

function editVacancy(id) {
    const vacancy = allVacancies.find(item => item.id === id);

    if (!vacancy) {
        showToast("Vacancy could not be found.", "error");
        return;
    }

    selectedVacancyId = id;

    document.getElementById("vacancyTitle").value = vacancy.title || "";
    document.getElementById("vacancyLocation").value = vacancy.location || "";
    document.getElementById("vacancyType").value = vacancy.type || "";
    document.getElementById("vacancyCategory").value = vacancy.category || "";
    document.getElementById("vacancySalaryMin").value = vacancy.salaryMin || "";
    document.getElementById("vacancySalaryMax").value = vacancy.salaryMax || "";
    document.getElementById("vacancyClosingDate").value = vacancy.closingDate || "";
    document.getElementById("vacancyStatus").value = vacancy.status || "Draft";
    document.getElementById("vacancyDescription").value = vacancy.description || "";
    document.getElementById("vacancyResponsibilities").value = Array.isArray(vacancy.responsibilities) ? vacancy.responsibilities.join("\n") : vacancy.responsibilities || "";
    document.getElementById("vacancyRequirements").value = Array.isArray(vacancy.requirements) ? vacancy.requirements.join("\n") : vacancy.requirements || "";

    setVacancyMessage(`Editing vacancy: ${vacancy.title || "Selected Vacancy"}`);
    showToast("Vacancy loaded into the form.", "info");
}

async function updateVacancy() {
    if (!selectedVacancyId) {
        setVacancyMessage("Please click Edit on a vacancy before updating.", true);
        return;
    }

    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot update vacancies.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/vacancies/${selectedVacancyId}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify(getVacancyFormData())
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to update vacancy.");
        }

        setVacancyMessage("Vacancy updated successfully.");
        showToast("Vacancy updated successfully.", "success");
        await loadVacancies();
    } catch (error) {
        console.error(error);
        setVacancyMessage(error.message || "Failed to update vacancy.", true);
        showToast(error.message || "Failed to update vacancy.", "error");
    }
}

async function setVacancyStatus(id, status) {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot update vacancies.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/vacancies/${id}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ status })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to update vacancy status.");
        }

        showToast(`Vacancy status changed to ${status}.`, "success");
        await loadVacancies();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to update vacancy status.", "error");
    }
}

async function deleteVacancy(id) {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot delete vacancies.", "error");
        return;
    }

    if (!confirm("Delete this vacancy?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/vacancies/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to delete vacancy.");
        }

        if (selectedVacancyId === id) {
            clearVacancyForm();
        }

        showToast("Vacancy deleted successfully.", "success");
        await loadVacancies();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to delete vacancy.", "error");
    }
}

function logoutAdmin() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");

    authToken = "";
    adminRole = "";
    selectedApplicationId = null;
    selectedContactMessageId = null;
    modalApplicationId = null;
    allApplications = [];
    allContactMessages = [];
    allVacancies = [];
    selectedVacancyId = null;

    stopAutoRefresh();
    closeCandidateModal();
    setDashboardVisible(false);

    showToast("Logged out successfully.", "success");
}

document.getElementById("sendInvitationBtn")?.addEventListener("click", sendInvitation);
document.getElementById("send7DayReminderBtn")?.addEventListener("click", function () {
    sendReminder("7day", this);
});

document.getElementById("send24HourReminderBtn")?.addEventListener("click", function () {
    sendReminder("24hour", this);
});

document.getElementById("sendSameDayReminderBtn")?.addEventListener("click", function () {
    sendReminder("sameday", this);
});
document.getElementById("logoutBtn")?.addEventListener("click", logoutAdmin);
document.getElementById("exportCsvBtn")?.addEventListener("click", exportApplicationsCSV);
document.getElementById("saveNotesBtn")?.addEventListener("click", saveCandidateNotes);
document.getElementById("createVacancyBtn")?.addEventListener("click", createVacancy);
document.getElementById("updateVacancyBtn")?.addEventListener("click", updateVacancy);
document.getElementById("clearVacancyFormBtn")?.addEventListener("click", clearVacancyForm);

candidateSearchInput?.addEventListener("input", applyCandidateFilters);
statusFilterSelect?.addEventListener("change", applyCandidateFilters);
clearFiltersBtn?.addEventListener("click", clearCandidateFilters);
manualRefreshBtn?.addEventListener("click", () => refreshDashboard(true));

window.loginAdmin = loginAdmin;
window.deleteApplication = deleteApplication;
window.selectCandidate = selectCandidate;
window.openCandidateModal = openCandidateModal;
window.closeCandidateModal = closeCandidateModal;
window.selectCandidateFromModal = selectCandidateFromModal;
window.moveModalCandidateToShortlist = moveModalCandidateToShortlist;
window.sendOfferFromModal = sendOfferFromModal;
window.sendOfferEmail = sendOfferEmail;
window.markCandidateHired = markCandidateHired;
window.sendRejectionFromModal = sendRejectionFromModal;
window.moveModalCandidateToOffer = moveModalCandidateToOffer;
window.moveModalCandidateToHired = moveModalCandidateToHired;
window.moveModalCandidateToRejected = moveModalCandidateToRejected;
window.updateApplicationStatus = updateApplicationStatus;
window.quickRejectApplication = quickRejectApplication;
window.deleteContactMessage = deleteContactMessage;
window.markMessageRead = markMessageRead;
window.viewContactMessage = viewContactMessage;
window.editVacancy = editVacancy;
window.updateVacancy = updateVacancy;
window.setVacancyStatus = setVacancyStatus;
window.deleteVacancy = deleteVacancy;

if (authToken) {
    setDashboardVisible(true);
    showLoggedInInfo();
    refreshDashboard();
    startAutoRefresh();
}