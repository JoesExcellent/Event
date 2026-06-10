const API_BASE = "";

let authToken = localStorage.getItem("adminToken") || "";
let adminRole = localStorage.getItem("adminRole") || "";
let selectedApplicationId = null;
let selectedContactMessageId = null;
let modalApplicationId = null;
let autoRefreshTimer = null;

let allApplications = [];
let allContactMessages = [];
let allCommunications = [];
let allVacancies = [];
let allEmailTemplates = [];
let allReminderQueue = [];
let selectedVacancyId = null;
let selectedEmailTemplateId = null;

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

const emailTemplatesTableBody = document.getElementById("emailTemplatesTableBody");
const templateIdInput = document.getElementById("templateId");
const templateNameInput = document.getElementById("templateName");
const templateCategoryInput = document.getElementById("templateCategory");
const templateSubjectInput = document.getElementById("templateSubject");
const templateBodyInput = document.getElementById("templateBody");
const templateMessage = document.getElementById("templateMessage");
const templatePreviewBox = document.getElementById("templatePreviewBox");
const templatePreviewSubject = document.getElementById("templatePreviewSubject");
const templatePreviewBody = document.getElementById("templatePreviewBody");
const reminderQueueTableBody = document.getElementById("reminderQueueTableBody");
const reminderQueueMessage = document.getElementById("reminderQueueMessage");
const offerCandidateNameInput = document.getElementById("offerCandidateName");
const offerCandidatePositionInput = document.getElementById("offerCandidatePosition");
const offerResponseStatusInput = document.getElementById("offerResponseStatus");
const candidateStartDateInput = document.getElementById("candidateStartDate");
const contractStatusInput = document.getElementById("contractStatus");
const onboardingStatusInput = document.getElementById("onboardingStatus");
const offerOnboardingNotesInput = document.getElementById("offerOnboardingNotes");
const offerTrackingTableBody = document.getElementById("offerTrackingTableBody");
const offerTrackingMessage = document.getElementById("offerTrackingMessage");

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
    await loadCommunications();
    await loadEmailTemplates();
    await loadReminderQueue();
    await loadVacancies();

    updateCommandCentre();
    renderActivityFeed();
    renderRecruiterTasks();
    renderCommunicationCentre();
    renderReminderQueue();
    renderOfferTrackingTable();
    renderPortalAccessTable();
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
                <button onclick="shortlistCandidate('${id}')">Shortlist</button>
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
    fillOfferTrackingForm(application);
    fillPortalAccessForm(application);
    document.getElementById("modalCandidateScore").textContent = `${score}%`;
    document.getElementById("modalCandidateStage").textContent = status;
    document.getElementById("modalCandidateMessage").textContent = application.message || "No application message available.";
    document.getElementById("modalCandidateNotes").textContent = application.notes || "No recruiter notes have been saved yet.";

    const modalStatus = document.getElementById("modalCandidateStatus");
    modalStatus.textContent = status;
    modalStatus.className = `ats-status-badge ${getStatusClass(status)}`;

    renderCandidateTimeline(application);
    renderCandidateCommunicationTimeline(application);
    renderCandidateResponseHistory(application);

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

    const records = allCommunications
        .filter(record =>
            (record.applicationId && record.applicationId === application.id) ||
            (record.candidateId && record.candidateId === application.id) ||
            (record.email && application.email && record.email.toLowerCase() === application.email.toLowerCase())
        )
        .sort((a, b) => new Date(b.sentAt || b.createdAt || 0) - new Date(a.sentAt || a.createdAt || 0));

    if (records.length) {
        timeline.innerHTML = records.map(record => `
            <li>
                <strong>${escapeHtml(record.action || record.communicationType || "Communication")}</strong>
                ${escapeHtml(formatDateTime(record.sentAt || record.createdAt))}<br>
                ${escapeHtml(record.communicationType || record.type || "Email")} — ${escapeHtml(record.status || "Sent")}
                ${record.emailId ? `<br>Reference: ${escapeHtml(record.emailId)}` : ""}
            </li>
        `).join("");
        return;
    }

    const items = [];

    if (application.applicationReceivedSent) {
        items.push({
            title: "Application Received Email Sent",
            text: application.lastCommunicationAt
                ? `Email sent on ${formatDateTime(application.lastCommunicationAt)}.`
                : "Application received email has been sent."
        });
    }

    if (application.invitationSent) {
        items.push({
            title: "Interview Invitation Sent",
            text: application.invitationSentAt
                ? `Email sent on ${formatDateTime(application.invitationSentAt)}.`
                : "Interview invitation email has been sent."
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

    if (application.offerSent) {
        items.push({
            title: "Offer Email Sent",
            text: application.offerSentAt
                ? `Email sent on ${formatDateTime(application.offerSentAt)}.`
                : "Offer email has been sent."
        });
    }

    if (application.hiredEmailSent) {
        items.push({
            title: "Employment Confirmation Email Sent",
            text: application.hiredEmailSentAt
                ? `Email sent on ${formatDateTime(application.hiredEmailSentAt)}.`
                : "Employment confirmation email has been sent."
        });
    }

    if (application.rejectionSent) {
        items.push({
            title: "Rejection Email Sent",
            text: application.rejectionSentAt
                ? `Email sent on ${formatDateTime(application.rejectionSentAt)}.`
                : "Rejection email has been sent."
        });
    }

    if (!items.length) {
        items.push({
            title: "No Email Activity Yet",
            text: "No email activity has been recorded for this candidate yet."
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
        fillOfferTrackingForm(selectedApplication);
        fillPortalAccessForm(selectedApplication);
    }

    showToast(`Selected ${fullName}`, "info");
}


function renderCandidateResponseHistory(application) {
    const timeline = document.getElementById("modalCandidateResponseHistory");

    if (!timeline) return;

    const history = Array.isArray(application.responseHistory)
        ? application.responseHistory
        : [];

    if (!history.length) {
        timeline.innerHTML = `
            <li>
                <strong>No Response History Yet</strong>
                No candidate interview response changes have been recorded yet.
            </li>
        `;
        return;
    }

    const sortedHistory = [...history].sort((a, b) =>
        new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0)
    );

    timeline.innerHTML = sortedHistory.map(entry => `
        <li>
            <strong>${escapeHtml(entry.action || "Interview Response Updated")}</strong>
            ${escapeHtml(formatDateTime(entry.timestamp || entry.createdAt || ""))}
            ${entry.source ? `<br>Source: ${escapeHtml(entry.source)}` : ""}
        </li>
    `).join("");
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
    if (!modalApplicationId) {
        showToast("Please open a candidate first.", "error");
        return;
    }

    await updateApplicationStatus(modalApplicationId, "Offer Made");

    try {
        const application = allApplications.find(app => app.id === modalApplicationId);
        if (application) {
            await saveOfferTrackingForApplication(application.id, {
                offerResponseStatus: application.offerResponseStatus || "Offer Pending",
                candidateStartDate: application.candidateStartDate || "",
                contractStatus: application.contractStatus || "Not Sent",
                onboardingStatus: application.onboardingStatus || "Not Started",
                offerOnboardingNotes: application.offerOnboardingNotes || ""
            }, false);
        }
    } catch (error) {
        console.error(error);
    }
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


async function shortlistCandidate(id) {
    if (!id) {
        showToast("Candidate could not be found.", "error");
        return;
    }

    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot shortlist candidates.", "error");
        return;
    }

    const application = allApplications.find(app => app.id === id);
    const candidateName = application?.fullName || "this candidate";

    if (!confirm(`Add ${candidateName} to the shortlist?`)) {
        return;
    }

    await updateApplicationStatus(id, "Shortlisted");
    showToast(`${candidateName} has been added to the shortlist.`, "success");
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

    if (!confirm(`Mark ${candidateName} as hired and send employment confirmation email?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/applications/${id}/hire`, {
            method: "POST",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to mark candidate as hired.");
        }

        showToast("Candidate marked as Hired and employment confirmation email sent.", "success");
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

    const shortlistedCount = applications.filter(app =>
        normaliseStatus(app.status).toLowerCase() === "shortlisted"
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
    if (newApplications) newApplications.textContent = shortlistedCount;
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
                ${shortlistedCount} shortlisted,
                ${interviewCount} in interview,
                ${hiredCount} hired.
            </p>
        `;
    }
}


function getDueReminderCount() {
    const now = new Date();

    return allReminderQueue.filter(reminder => {
        const status = String(reminder.status || "Scheduled").toLowerCase();
        const dueAt = new Date(reminder.dueAt || reminder.scheduledFor || 0);

        return status !== "sent" &&
               status !== "cancelled" &&
               !Number.isNaN(dueAt.getTime()) &&
               dueAt <= now;
    }).length;
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
    ).length + getDueReminderCount();

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

    allReminderQueue
        .filter(reminder => {
            const status = String(reminder.status || "Scheduled").toLowerCase();
            const dueAt = new Date(reminder.dueAt || reminder.scheduledFor || 0);

            return status !== "sent" &&
                   status !== "cancelled" &&
                   !Number.isNaN(dueAt.getTime()) &&
                   dueAt <= new Date();
        })
        .slice(0, 5)
        .forEach(reminder => {
            tasks.push({
                title: "Reminder Due",
                text: `${reminder.candidateName || "Candidate"} is due: ${reminder.reminderLabel || reminder.reminderType || "Interview Reminder"}.`
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


async function loadCommunications() {
    try {
        const response = await fetch(`${API_BASE}/api/communications`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to load communication records.");
        }

        allCommunications = result.communications || [];
    } catch (error) {
        console.error(error);
        allCommunications = [];

        if (communicationTableBody) {
            communicationTableBody.innerHTML = `
                <tr>
                    <td colspan="6">Failed to load communication records.</td>
                </tr>
            `;
        }
    }
}

function renderCommunicationCentre() {
    if (!communicationTableBody) return;

    const communicationRecords = allCommunications.slice()
        .sort((a, b) => new Date(b.sentAt || b.createdAt || 0) - new Date(a.sentAt || a.createdAt || 0));

    if (!communicationRecords.length) {
        communicationTableBody.innerHTML = `
            <tr>
                <td colspan="6">No communication records found.</td>
            </tr>
        `;
        return;
    }

    communicationTableBody.innerHTML = "";

    communicationRecords.slice(0, 100).forEach(record => {
        const needsFollowUp = String(record.followUp || "").toLowerCase().includes("required");
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${escapeHtml(record.candidateName || "Candidate")}</td>
            <td>${escapeHtml(record.email || "N/A")}</td>
            <td>${escapeHtml(record.communicationType || record.type || "Email")}</td>
            <td>${escapeHtml(record.status || "Sent")}</td>
            <td>${escapeHtml(formatDateTime(record.sentAt || record.createdAt))}</td>
            <td>${needsFollowUp ? "Follow up required" : escapeHtml(record.followUp || "No urgent follow-up")}</td>
        `;

        communicationTableBody.appendChild(tr);
    });
}


function setReminderQueueMessage(message, isError = false) {
    if (!reminderQueueMessage) return;

    reminderQueueMessage.textContent = message || "";
    reminderQueueMessage.style.color = isError ? "#ff6a00" : "#ffffff";
    reminderQueueMessage.style.fontWeight = "700";
    reminderQueueMessage.style.marginTop = "14px";
}

async function loadReminderQueue() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/reminder-queue`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to load reminder queue.");
        }

        allReminderQueue = result.reminders || [];
    } catch (error) {
        console.error(error);
        allReminderQueue = [];

        if (reminderQueueTableBody) {
            reminderQueueTableBody.innerHTML = `
                <tr>
                    <td colspan="6">Failed to load reminder schedule records.</td>
                </tr>
            `;
        }
    }
}

function getReminderDisplayStatus(reminder) {
    const status = String(reminder.status || "Scheduled");

    if (status.toLowerCase() === "sent") return "Sent";
    if (status.toLowerCase() === "failed") return "Failed";
    if (status.toLowerCase() === "cancelled") return "Cancelled";

    const dueAt = new Date(reminder.dueAt || reminder.scheduledFor || 0);

    if (!Number.isNaN(dueAt.getTime()) && dueAt <= new Date()) {
        return "Due Now";
    }

    return status;
}

function renderReminderQueue() {
    if (!reminderQueueTableBody) return;

    const reminders = allReminderQueue.slice()
        .sort((a, b) => new Date(a.dueAt || a.scheduledFor || 0) - new Date(b.dueAt || b.scheduledFor || 0));

    if (!reminders.length) {
        reminderQueueTableBody.innerHTML = `
            <tr>
                <td colspan="6">No scheduled reminders found.</td>
            </tr>
        `;
        return;
    }

    reminderQueueTableBody.innerHTML = reminders.slice(0, 100).map(reminder => {
        const displayStatus = getReminderDisplayStatus(reminder);
        const canSend = !["Sent", "Cancelled"].includes(displayStatus);

        return `
            <tr>
                <td>${escapeHtml(reminder.candidateName || "Candidate")}</td>
                <td>${escapeHtml(reminder.email || "N/A")}</td>
                <td>${escapeHtml(reminder.reminderLabel || reminder.reminderType || "Interview Reminder")}</td>
                <td>${escapeHtml(formatDateTime(reminder.dueAt || reminder.scheduledFor))}</td>
                <td>${escapeHtml(displayStatus)}</td>
                <td>
                    ${canSend ? `<button type="button" onclick="sendQueuedReminder('${escapeQuotes(reminder.id)}')">Send Now</button>` : ""}
                </td>
            </tr>
        `;
    }).join("");
}

async function scheduleInterviewRemindersForSelectedCandidate() {
    if (!selectedApplicationId) {
        showToast("Please select a candidate first.", "error");
        return;
    }

    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot schedule reminders.", "error");
        return;
    }

    if (!confirm("Schedule 7 day, 24 hour and same day interview reminders for this candidate?")) {
        return;
    }

    try {
        const payload = {
            interviewDate: document.getElementById("interviewDate")?.value || "",
            interviewTime: document.getElementById("interviewTime")?.value || "",
            interviewLocation: document.getElementById("interviewLocation")?.value || ""
        };

        const response = await fetch(`${API_BASE}/api/admin/applications/${selectedApplicationId}/schedule-reminders`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to schedule reminders.");
        }

        showToast(result.message || "Interview reminders scheduled.", "success");
        setReminderQueueMessage(result.message || "Interview reminders scheduled.");
        await refreshDashboard();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to schedule reminders.", "error");
        setReminderQueueMessage(error.message || "Failed to schedule reminders.", true);
    }
}

async function processDueReminders() {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot process reminders.", "error");
        return;
    }

    if (!confirm("Process all reminders that are due now?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/reminders/process-due`, {
            method: "POST",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to process reminders.");
        }

        showToast(result.message || "Due reminders processed.", "success");
        setReminderQueueMessage(result.message || "Due reminders processed.");
        await refreshDashboard();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to process reminders.", "error");
        setReminderQueueMessage(error.message || "Failed to process reminders.", true);
    }
}

async function sendQueuedReminder(id) {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot send queued reminders.", "error");
        return;
    }

    if (!confirm("Send this scheduled reminder now?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/reminder-queue/${encodeURIComponent(id)}/send`, {
            method: "POST",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to send queued reminder.");
        }

        showToast(result.message || "Queued reminder sent.", "success");
        setReminderQueueMessage(result.message || "Queued reminder sent.");
        await refreshDashboard();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to send queued reminder.", "error");
        setReminderQueueMessage(error.message || "Failed to send queued reminder.", true);
    }
}


function setOfferTrackingMessage(message, isError = false) {
    if (!offerTrackingMessage) return;
    offerTrackingMessage.textContent = message || "";
    offerTrackingMessage.style.color = isError ? "#ff6a00" : "#ffffff";
    offerTrackingMessage.style.fontWeight = "700";
    offerTrackingMessage.style.marginTop = "14px";
}

function getSelectedOfferApplication() {
    const id = modalApplicationId || selectedApplicationId;
    return allApplications.find(app => app.id === id) || null;
}

function fillOfferTrackingForm(application) {
    if (!application) return;

    if (offerCandidateNameInput) offerCandidateNameInput.value = application.fullName || "";
    if (offerCandidatePositionInput) offerCandidatePositionInput.value = application.position || "";
    if (offerResponseStatusInput) offerResponseStatusInput.value = application.offerResponseStatus || (normaliseStatus(application.status) === "Offer Made" ? "Offer Pending" : "");
    if (candidateStartDateInput) candidateStartDateInput.value = application.candidateStartDate || "";
    if (contractStatusInput) contractStatusInput.value = application.contractStatus || "";
    if (onboardingStatusInput) onboardingStatusInput.value = application.onboardingStatus || "";
    if (offerOnboardingNotesInput) offerOnboardingNotesInput.value = application.offerOnboardingNotes || "";
}

function clearOfferTrackingForm() {
    if (offerCandidateNameInput) offerCandidateNameInput.value = "";
    if (offerCandidatePositionInput) offerCandidatePositionInput.value = "";
    if (offerResponseStatusInput) offerResponseStatusInput.value = "";
    if (candidateStartDateInput) candidateStartDateInput.value = "";
    if (contractStatusInput) contractStatusInput.value = "";
    if (onboardingStatusInput) onboardingStatusInput.value = "";
    if (offerOnboardingNotesInput) offerOnboardingNotesInput.value = "";
    setOfferTrackingMessage("");
}

function getOfferTrackingPayload(overrides = {}) {
    return {
        offerResponseStatus: overrides.offerResponseStatus !== undefined ? overrides.offerResponseStatus : (offerResponseStatusInput?.value || ""),
        candidateStartDate: overrides.candidateStartDate !== undefined ? overrides.candidateStartDate : (candidateStartDateInput?.value || ""),
        contractStatus: overrides.contractStatus !== undefined ? overrides.contractStatus : (contractStatusInput?.value || ""),
        onboardingStatus: overrides.onboardingStatus !== undefined ? overrides.onboardingStatus : (onboardingStatusInput?.value || ""),
        offerOnboardingNotes: overrides.offerOnboardingNotes !== undefined ? overrides.offerOnboardingNotes : (offerOnboardingNotesInput?.value || "")
    };
}

async function saveOfferTrackingForApplication(id, payload, showSuccess = true) {
    if (!id) {
        throw new Error("No candidate selected for offer tracking.");
    }

    const response = await fetch(`${API_BASE}/api/admin/applications/${id}/offer-tracking`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Failed to save offer tracking.");
    }

    if (showSuccess) {
        showToast(result.message || "Offer tracking saved.", "success");
        setOfferTrackingMessage(result.message || "Offer tracking saved.");
    }

    return result;
}

async function saveOfferTracking() {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot save offer tracking.", "error");
        return;
    }

    const application = getSelectedOfferApplication();

    if (!application) {
        showToast("Please select or open a candidate first.", "error");
        setOfferTrackingMessage("Please select or open a candidate first.", true);
        return;
    }

    try {
        await saveOfferTrackingForApplication(application.id, getOfferTrackingPayload(), true);
        await refreshDashboard();

        const updated = allApplications.find(app => app.id === application.id);
        if (updated) fillOfferTrackingForm(updated);
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to save offer tracking.", "error");
        setOfferTrackingMessage(error.message || "Failed to save offer tracking.", true);
    }
}

async function setOfferWorkflowStatus(offerResponseStatus) {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot update offer tracking.", "error");
        return;
    }

    const application = getSelectedOfferApplication();

    if (!application) {
        showToast("Please select or open a candidate first.", "error");
        setOfferTrackingMessage("Please select or open a candidate first.", true);
        return;
    }

    const payload = getOfferTrackingPayload({ offerResponseStatus });

    if (offerResponseStatus === "Offer Accepted") {
        payload.onboardingStatus = payload.onboardingStatus || "In Progress";
        payload.contractStatus = payload.contractStatus || "Sent";
    }

    if (offerResponseStatus === "Offer Declined") {
        payload.onboardingStatus = "Not Started";
    }

    try {
        await saveOfferTrackingForApplication(application.id, payload, false);
        showToast(`${offerResponseStatus} recorded.`, "success");
        setOfferTrackingMessage(`${offerResponseStatus} recorded.`);
        await refreshDashboard();

        const updated = allApplications.find(app => app.id === application.id);
        if (updated) fillOfferTrackingForm(updated);
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to update offer workflow.", "error");
        setOfferTrackingMessage(error.message || "Failed to update offer workflow.", true);
    }
}

async function confirmStartDate() {
    const application = getSelectedOfferApplication();

    if (!application) {
        showToast("Please select or open a candidate first.", "error");
        setOfferTrackingMessage("Please select or open a candidate first.", true);
        return;
    }

    if (!candidateStartDateInput?.value) {
        showToast("Please enter a start date before confirming.", "error");
        setOfferTrackingMessage("Please enter a start date before confirming.", true);
        return;
    }

    const payload = getOfferTrackingPayload({
        offerResponseStatus: offerResponseStatusInput?.value || "Offer Accepted",
        onboardingStatus: onboardingStatusInput?.value || "Ready For Start"
    });

    try {
        await saveOfferTrackingForApplication(application.id, payload, false);
        showToast("Start date confirmed.", "success");
        setOfferTrackingMessage("Start date confirmed.");
        await refreshDashboard();

        const updated = allApplications.find(app => app.id === application.id);
        if (updated) fillOfferTrackingForm(updated);
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to confirm start date.", "error");
        setOfferTrackingMessage(error.message || "Failed to confirm start date.", true);
    }
}

function renderOfferTrackingTable() {
    if (!offerTrackingTableBody) return;

    const records = allApplications.filter(app => {
        return normaliseStatus(app.status) === "Offer Made" ||
               normaliseStatus(app.status) === "Hired" ||
               app.offerResponseStatus ||
               app.candidateStartDate ||
               app.contractStatus ||
               app.onboardingStatus;
    });

    if (!records.length) {
        offerTrackingTableBody.innerHTML = `
            <tr>
                <td colspan="6">No offer response or start date records found yet.</td>
            </tr>
        `;
        return;
    }

    offerTrackingTableBody.innerHTML = records.map(app => `
        <tr>
            <td>${escapeHtml(app.fullName || "Candidate")}</td>
            <td>${escapeHtml(app.position || "N/A")}</td>
            <td>${escapeHtml(app.offerResponseStatus || (normaliseStatus(app.status) === "Offer Made" ? "Offer Pending" : ""))}</td>
            <td>${escapeHtml(formatDate(app.candidateStartDate || ""))}</td>
            <td>${escapeHtml(app.contractStatus || "")}</td>
            <td>${escapeHtml(app.onboardingStatus || "")}</td>
        </tr>
    `).join("");
}


function getTemplateSampleData() {
    return {
        candidateName: "Gary Linekar",
        position: "Head of BBC Sport",
        interviewDate: "Monday, 15 June 2026",
        interviewTime: "10:00 AM",
        interviewLocation: "Microsoft Teams",
        salary: "£230,000 - £250,000",
        startDate: "Monday, 1 July 2026",
        companyName: "Joe's Excellent Events & Management"
    };
}

function renderTemplateContent(content, data = getTemplateSampleData()) {
    return String(content || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, function (_, key) {
        return data[key] !== undefined && data[key] !== null ? String(data[key]) : "";
    });
}

function setTemplateMessage(message, isError = false) {
    if (!templateMessage) return;
    templateMessage.textContent = message || "";
    templateMessage.style.color = isError ? "#ff6a00" : "#ffffff";
    templateMessage.style.fontWeight = "700";
    templateMessage.style.marginTop = "14px";
}

async function loadEmailTemplates() {
    if (!emailTemplatesTableBody) return;

    try {
        const response = await fetch(`${API_BASE}/api/admin/email-templates`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to load email templates.");
        }

        allEmailTemplates = result.templates || [];
        renderEmailTemplates();
    } catch (error) {
        console.error(error);
        emailTemplatesTableBody.innerHTML = `
            <tr>
                <td colspan="5">${escapeHtml(error.message || "Failed to load email templates.")}</td>
            </tr>
        `;
    }
}

function renderEmailTemplates() {
    if (!emailTemplatesTableBody) return;

    if (!allEmailTemplates.length) {
        emailTemplatesTableBody.innerHTML = `
            <tr>
                <td colspan="5">No email templates available yet.</td>
            </tr>
        `;
        return;
    }

    emailTemplatesTableBody.innerHTML = allEmailTemplates.map(template => `
        <tr>
            <td>${escapeHtml(template.name || "Template")}</td>
            <td>${escapeHtml(template.category || "General")}</td>
            <td>${escapeHtml(template.subject || "")}</td>
            <td>${escapeHtml(formatDateTime(template.updatedAt || template.createdAt || ""))}</td>
            <td>
                <button type="button" onclick="editEmailTemplate('${escapeQuotes(template.id)}')">Edit</button>
                <button type="button" onclick="previewEmailTemplate('${escapeQuotes(template.id)}')">Preview</button>
                <button type="button" onclick="restoreEmailTemplate('${escapeQuotes(template.id)}')">Restore Default</button>
            </td>
        </tr>
    `).join("");
}

function clearEmailTemplateEditor() {
    selectedEmailTemplateId = null;

    if (templateIdInput) templateIdInput.value = "";
    if (templateNameInput) templateNameInput.value = "";
    if (templateCategoryInput) templateCategoryInput.value = "";
    if (templateSubjectInput) templateSubjectInput.value = "";
    if (templateBodyInput) templateBodyInput.value = "";
    if (templatePreviewBox) templatePreviewBox.style.display = "none";

    setTemplateMessage("");
}

function editEmailTemplate(id) {
    const template = allEmailTemplates.find(item => item.id === id);

    if (!template) {
        showToast("Template could not be found.", "error");
        return;
    }

    selectedEmailTemplateId = id;

    if (templateIdInput) templateIdInput.value = template.id || "";
    if (templateNameInput) templateNameInput.value = template.name || "";
    if (templateCategoryInput) templateCategoryInput.value = template.category || "";
    if (templateSubjectInput) templateSubjectInput.value = template.subject || "";
    if (templateBodyInput) templateBodyInput.value = template.body || "";
    if (templatePreviewBox) templatePreviewBox.style.display = "none";

    setTemplateMessage(`Editing ${template.name || "template"}.`);
}

function previewEmailTemplate(id = "") {
    let template = null;

    if (id) {
        template = allEmailTemplates.find(item => item.id === id);
        if (template) {
            selectedEmailTemplateId = id;
        }
    }

    const subject = template
        ? template.subject
        : templateSubjectInput?.value || "";

    const body = template
        ? template.body
        : templateBodyInput?.value || "";

    if (!subject && !body) {
        showToast("Select a template or enter template text before previewing.", "error");
        return;
    }

    const renderedSubject = renderTemplateContent(subject);
    const renderedBody = renderTemplateContent(body);

    if (templatePreviewSubject) {
        templatePreviewSubject.textContent = renderedSubject || "No subject";
    }

    if (templatePreviewBody) {
        templatePreviewBody.innerHTML = renderedBody
            .split(/\n+/)
            .filter(line => line.trim())
            .map(line => `<p>${escapeHtml(line)}</p>`)
            .join("");
    }

    if (templatePreviewBox) {
        templatePreviewBox.style.display = "block";
    }

    if (template && templateIdInput) {
        editEmailTemplate(template.id);
    }
}

async function saveEmailTemplate() {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot edit templates.", "error");
        return;
    }

    const id = selectedEmailTemplateId || templateIdInput?.value || "";

    if (!id) {
        showToast("Select a template to edit first.", "error");
        return;
    }

    const payload = {
        subject: templateSubjectInput?.value || "",
        body: templateBodyInput?.value || ""
    };

    if (!payload.subject.trim() || !payload.body.trim()) {
        showToast("Template subject and body are required.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/email-templates/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to save template.");
        }

        showToast("Template saved successfully.", "success");
        setTemplateMessage("Template saved successfully.");
        await loadEmailTemplates();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to save template.", "error");
        setTemplateMessage(error.message || "Failed to save template.", true);
    }
}

async function restoreEmailTemplate(id = "") {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot restore templates.", "error");
        return;
    }

    const templateId = id || selectedEmailTemplateId || templateIdInput?.value || "";

    if (!templateId) {
        showToast("Select a template to restore first.", "error");
        return;
    }

    if (!confirm("Restore this template to the approved default version?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/email-templates/${encodeURIComponent(templateId)}/restore`, {
            method: "POST",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to restore template.");
        }

        showToast("Template restored successfully.", "success");
        setTemplateMessage("Template restored successfully.");
        await loadEmailTemplates();
        editEmailTemplate(templateId);
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to restore template.", "error");
        setTemplateMessage(error.message || "Failed to restore template.", true);
    }
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
    allEmailTemplates = [];
    allReminderQueue = [];
    selectedVacancyId = null;
    selectedEmailTemplateId = null;

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
document.getElementById("saveTemplateBtn")?.addEventListener("click", saveEmailTemplate);
document.getElementById("previewTemplateBtn")?.addEventListener("click", function () {
    previewEmailTemplate();
});
document.getElementById("restoreTemplateBtn")?.addEventListener("click", function () {
    restoreEmailTemplate();
});
document.getElementById("clearTemplateEditorBtn")?.addEventListener("click", clearEmailTemplateEditor);
document.getElementById("saveOfferTrackingBtn")?.addEventListener("click", saveOfferTracking);
document.getElementById("markOfferAcceptedBtn")?.addEventListener("click", function () {
    setOfferWorkflowStatus("Offer Accepted");
});
document.getElementById("markOfferDeclinedBtn")?.addEventListener("click", function () {
    setOfferWorkflowStatus("Offer Declined");
});
document.getElementById("confirmStartDateBtn")?.addEventListener("click", confirmStartDate);
document.getElementById("clearOfferTrackingBtn")?.addEventListener("click", clearOfferTrackingForm);
document.getElementById("scheduleInterviewRemindersBtn")?.addEventListener("click", scheduleInterviewRemindersForSelectedCandidate);
document.getElementById("processDueRemindersBtn")?.addEventListener("click", processDueReminders);
document.getElementById("refreshReminderQueueBtn")?.addEventListener("click", async function () {
    await loadReminderQueue();
    renderReminderQueue();
    showToast("Reminder queue refreshed.", "success");
});

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
window.shortlistCandidate = shortlistCandidate;
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
window.editEmailTemplate = editEmailTemplate;
window.previewEmailTemplate = previewEmailTemplate;
window.saveEmailTemplate = saveEmailTemplate;
window.restoreEmailTemplate = restoreEmailTemplate;
window.clearEmailTemplateEditor = clearEmailTemplateEditor;
window.saveOfferTracking = saveOfferTracking;
window.clearOfferTrackingForm = clearOfferTrackingForm;
window.setOfferWorkflowStatus = setOfferWorkflowStatus;
window.confirmStartDate = confirmStartDate;
window.renderOfferTrackingTable = renderOfferTrackingTable;
window.scheduleInterviewRemindersForSelectedCandidate = scheduleInterviewRemindersForSelectedCandidate;
window.processDueReminders = processDueReminders;
window.sendQueuedReminder = sendQueuedReminder;


/* =====================================================
   PHASE 4F - CANDIDATE PORTAL ACCESS
===================================================== */

function setPortalAccessMessage(message, isError = false) {
    const box = document.getElementById("portalAccessMessage");
    if (!box) return;
    box.textContent = message || "";
    box.style.color = isError ? "#ff6a00" : "#ffffff";
    box.style.fontWeight = "700";
    box.style.marginTop = "14px";
}

function getSelectedPortalApplication() {
    const id = modalApplicationId || selectedApplicationId;
    return allApplications.find(app => app.id === id) || null;
}

function fillPortalAccessForm(application) {
    if (!application) return;

    const map = {
        portalCandidateName: application.fullName || "",
        portalCandidateEmail: application.email || "",
        portalAccessStatus: application.portalAccessStatus || "",
        documentDownloadStatus: application.documentDownloadStatus || "",
        contractAcceptanceStatus: application.contractAcceptanceStatus || "",
        eSignatureStatus: application.eSignatureStatus || "",
        selfServiceStatus: application.selfServiceStatus || "",
        portalAccessDate: application.portalAccessDate || "",
        portalAccessNotes: application.portalAccessNotes || ""
    };

    Object.keys(map).forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = map[id];
    });
}

function clearPortalAccessForm() {
    [
        "portalCandidateName",
        "portalCandidateEmail",
        "portalAccessStatus",
        "documentDownloadStatus",
        "contractAcceptanceStatus",
        "eSignatureStatus",
        "selfServiceStatus",
        "portalAccessDate",
        "portalAccessNotes"
    ].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = "";
    });

    setPortalAccessMessage("");
}

function getPortalAccessPayload(overrides = {}) {
    return {
        portalAccessStatus: overrides.portalAccessStatus !== undefined ? overrides.portalAccessStatus : (document.getElementById("portalAccessStatus")?.value || ""),
        documentDownloadStatus: overrides.documentDownloadStatus !== undefined ? overrides.documentDownloadStatus : (document.getElementById("documentDownloadStatus")?.value || ""),
        contractAcceptanceStatus: overrides.contractAcceptanceStatus !== undefined ? overrides.contractAcceptanceStatus : (document.getElementById("contractAcceptanceStatus")?.value || ""),
        eSignatureStatus: overrides.eSignatureStatus !== undefined ? overrides.eSignatureStatus : (document.getElementById("eSignatureStatus")?.value || ""),
        selfServiceStatus: overrides.selfServiceStatus !== undefined ? overrides.selfServiceStatus : (document.getElementById("selfServiceStatus")?.value || ""),
        portalAccessDate: overrides.portalAccessDate !== undefined ? overrides.portalAccessDate : (document.getElementById("portalAccessDate")?.value || ""),
        portalAccessNotes: overrides.portalAccessNotes !== undefined ? overrides.portalAccessNotes : (document.getElementById("portalAccessNotes")?.value || "")
    };
}

async function savePortalAccessForApplication(id, payload, showSuccess = true) {
    if (!id) {
        throw new Error("No candidate selected for portal access.");
    }

    const response = await fetch(`${API_BASE}/api/admin/applications/${id}/portal-access`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Failed to save portal access.");
    }

    if (showSuccess) {
        showToast(result.message || "Portal access saved.", "success");
        setPortalAccessMessage(result.message || "Portal access saved.");
    }

    return result;
}

async function savePortalAccess() {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot save portal access.", "error");
        return;
    }

    const application = getSelectedPortalApplication();

    if (!application) {
        showToast("Please select or open a candidate first.", "error");
        setPortalAccessMessage("Please select or open a candidate first.", true);
        return;
    }

    try {
        await savePortalAccessForApplication(application.id, getPortalAccessPayload());
        await refreshDashboard();

        const updated = allApplications.find(app => app.id === application.id);
        if (updated) fillPortalAccessForm(updated);
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to save portal access.", "error");
        setPortalAccessMessage(error.message || "Failed to save portal access.", true);
    }
}

async function sendPortalInvite() {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot send portal invites.", "error");
        return;
    }

    const application = getSelectedPortalApplication();

    if (!application) {
        showToast("Please select or open a candidate first.", "error");
        setPortalAccessMessage("Please select or open a candidate first.", true);
        return;
    }

    if (!confirm(`Send portal access invite to ${application.fullName || "this candidate"}?`)) {
        return;
    }

    try {
        const payload = getPortalAccessPayload({
            portalAccessStatus: "Invite Sent",
            documentDownloadStatus: document.getElementById("documentDownloadStatus")?.value || "Available",
            selfServiceStatus: document.getElementById("selfServiceStatus")?.value || "Enabled",
            portalAccessDate: document.getElementById("portalAccessDate")?.value || new Date().toISOString().slice(0, 10)
        });

        const response = await fetch(`${API_BASE}/api/admin/applications/${application.id}/portal-invite`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to send portal invite.");
        }

        showToast(result.message || "Portal invite sent.", "success");
        setPortalAccessMessage(result.message || "Portal invite sent.");
        await refreshDashboard();

        const updated = allApplications.find(app => app.id === application.id);
        if (updated) fillPortalAccessForm(updated);
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to send portal invite.", "error");
        setPortalAccessMessage(error.message || "Failed to send portal invite.", true);
    }
}

async function markContractAccepted() {
    if (adminRole === "viewer") {
        showToast("Viewer accounts cannot update contract acceptance.", "error");
        return;
    }

    const application = getSelectedPortalApplication();

    if (!application) {
        showToast("Please select or open a candidate first.", "error");
        setPortalAccessMessage("Please select or open a candidate first.", true);
        return;
    }

    try {
        const payload = getPortalAccessPayload({
            contractAcceptanceStatus: "Accepted",
            eSignatureStatus: document.getElementById("eSignatureStatus")?.value || "Signed",
            documentDownloadStatus: document.getElementById("documentDownloadStatus")?.value || "Acknowledged",
            portalAccessStatus: document.getElementById("portalAccessStatus")?.value || "Active"
        });

        await savePortalAccessForApplication(application.id, payload, false);
        showToast("Contract acceptance recorded.", "success");
        setPortalAccessMessage("Contract acceptance recorded.");
        await refreshDashboard();

        const updated = allApplications.find(app => app.id === application.id);
        if (updated) fillPortalAccessForm(updated);
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to mark contract accepted.", "error");
        setPortalAccessMessage(error.message || "Failed to mark contract accepted.", true);
    }
}

function renderPortalAccessTable() {
    const tableBody = document.getElementById("portalAccessTableBody");
    if (!tableBody) return;

    const records = allApplications.filter(app => {
        return app.portalAccessStatus ||
               app.documentDownloadStatus ||
               app.contractAcceptanceStatus ||
               app.eSignatureStatus ||
               app.selfServiceStatus;
    });

    if (!records.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">No candidate portal access records found yet.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = records.map(app => `
        <tr>
            <td>${escapeHtml(app.fullName || "Candidate")}</td>
            <td>${escapeHtml(app.email || "")}</td>
            <td>${escapeHtml(app.portalAccessStatus || "")}</td>
            <td>${escapeHtml(app.documentDownloadStatus || "")}</td>
            <td>${escapeHtml(app.contractAcceptanceStatus || "")}</td>
            <td>${escapeHtml(app.selfServiceStatus || "")}</td>
        </tr>
    `).join("");
}

document.getElementById("savePortalAccessBtn")?.addEventListener("click", savePortalAccess);
document.getElementById("sendPortalInviteBtn")?.addEventListener("click", sendPortalInvite);
document.getElementById("markContractAcceptedBtn")?.addEventListener("click", markContractAccepted);
document.getElementById("clearPortalAccessBtn")?.addEventListener("click", clearPortalAccessForm);

window.savePortalAccess = savePortalAccess;
window.sendPortalInvite = sendPortalInvite;
window.markContractAccepted = markContractAccepted;
window.clearPortalAccessForm = clearPortalAccessForm;
window.renderPortalAccessTable = renderPortalAccessTable;


if (authToken) {
    setDashboardVisible(true);
    showLoggedInInfo();
    refreshDashboard();
    startAutoRefresh();
}