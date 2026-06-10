/* =====================================================
   JOE'S EXCELLENT EVENTS & MANAGEMENT
   PHASE 5A.1 - CANDIDATE SELF-SERVICE PORTAL
===================================================== */

const CANDIDATE_TOKEN_KEY = "temcCandidateToken";
const CANDIDATE_EMAIL_KEY = "temcCandidateEmail";

const loginSection = document.getElementById("candidateLoginSection");
const dashboardSection = document.getElementById("candidateDashboardSection");
const loginForm = document.getElementById("candidateLoginForm");
const candidateEmailInput = document.getElementById("candidateEmail");
const candidateLoginMessage = document.getElementById("candidateLoginMessage");
const logoutCandidateBtn = document.getElementById("logoutCandidateBtn");
const refreshCandidateBtn = document.getElementById("refreshCandidateBtn");
const acceptInterviewBtn = document.getElementById("acceptInterviewBtn");
const declineInterviewBtn = document.getElementById("declineInterviewBtn");
const interviewResponseActions = document.getElementById("interviewResponseActions");
const interviewResponseMessage = document.getElementById("interviewResponseMessage");

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value || "N/A";
    }
}

function setStatus(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    element.textContent = value || "N/A";
    element.className = "candidate-status-badge " + statusClass(value);
}

function statusClass(value) {
    const status = String(value || "").toLowerCase();

    if (status.includes("accepted") || status.includes("active") || status.includes("ready") || status.includes("completed") || status.includes("signed") || status.includes("enabled") || status.includes("sent")) {
        return "status-good";
    }

    if (status.includes("pending") || status.includes("progress") || status.includes("viewed") || status.includes("available") || status.includes("scheduled") || status.includes("invited")) {
        return "status-warning";
    }

    if (status.includes("declined") || status.includes("rejected") || status.includes("disabled") || status.includes("suspended")) {
        return "status-danger";
    }

    return "status-neutral";
}

function formatDate(value) {
    if (!value) return "N/A";

    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    } catch (error) {
        return value;
    }
}

function getCandidateToken() {
    return localStorage.getItem(CANDIDATE_TOKEN_KEY) || "";
}

function showLogin(message = "") {
    loginSection.style.display = "block";
    dashboardSection.style.display = "none";

    if (message) {
        candidateLoginMessage.textContent = message;
        candidateLoginMessage.style.color = "#ff6a00";
    }
}

function showDashboard() {
    loginSection.style.display = "none";
    dashboardSection.style.display = "block";
}

async function candidateLogin(event) {
    event.preventDefault();

    const email = candidateEmailInput.value.trim();

    if (!email) {
        candidateLoginMessage.textContent = "Please enter your email address.";
        candidateLoginMessage.style.color = "#ff6a00";
        return;
    }

    candidateLoginMessage.textContent = "Checking your application...";
    candidateLoginMessage.style.color = "#ffffff";

    try {
        const response = await fetch("/api/candidate/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Candidate login failed.");
        }

        localStorage.setItem(CANDIDATE_TOKEN_KEY, result.token);
        localStorage.setItem(CANDIDATE_EMAIL_KEY, email);

        renderCandidate(result.candidate);
        showDashboard();
    } catch (error) {
        candidateLoginMessage.textContent = error.message || "We could not find your application. Please check your email address.";
        candidateLoginMessage.style.color = "#ff6a00";
    }
}

async function loadCandidateProfile() {
    const token = getCandidateToken();

    if (!token) {
        showLogin();
        return;
    }

    try {
        const response = await fetch("/api/candidate/profile", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Candidate session expired.");
        }

        renderCandidate(result.candidate);
        showDashboard();
    } catch (error) {
        localStorage.removeItem(CANDIDATE_TOKEN_KEY);
        showLogin(error.message || "Please sign in again.");
    }
}

function renderCandidate(candidate) {
    if (!candidate) return;

    setText("welcomeCandidateName", candidate.fullName || candidate.name || "Candidate");
    setText("applicationName", candidate.fullName || candidate.name || "Candidate");
    setText("applicationEmail", candidate.email);
    setText("applicationPhone", candidate.phone);
    setText("applicationPosition", candidate.position);
    setText("applicationAvailability", candidate.availability);
    setText("applicationDate", formatDate(candidate.createdAt));
    setStatus("applicationStatus", candidate.status);

    setText("interviewDate", formatDate(candidate.interviewDate));
    setText("interviewTime", candidate.interviewTime || "N/A");
    setText("interviewLocation", candidate.interviewLocation || "N/A");

    const interviewStatusValue = candidate.interviewStatus || (candidate.invitationSent ? "Interview Invitation Sent" : candidate.status || "Not Scheduled");
    const interviewResponseValue = candidate.interviewResponse || "Pending";

    setStatus("interviewStatus", interviewStatusValue);
    setStatus("interviewResponse", interviewResponseValue);
    updateInterviewResponseControls(interviewResponseValue);

    setStatus("offerResponseStatus", candidate.offerResponseStatus || "Not Yet Recorded");
    setText("candidateStartDate", formatDate(candidate.candidateStartDate));
    setStatus("contractStatus", candidate.contractStatus || "Not Sent");
    setStatus("onboardingStatus", candidate.onboardingStatus || "Not Started");

    setStatus("welcomePackStatus", candidate.welcomePackStatus || "Not Sent");
    setStatus("handbookStatus", candidate.handbookStatus || "Not Sent");
    setStatus("rtwStatus", candidate.rtwStatus || "Pending");
    setStatus("dbsStatus", candidate.dbsStatus || "Not Required");
    setStatus("trainingStatus", candidate.trainingStatus || "Not Started");
    setText("inductionDate", formatDate(candidate.inductionDate));
    setStatus("inductionStatus", candidate.inductionStatus || "Not Scheduled");
    setStatus("readyToStart", candidate.readyToStart || "No");

    setStatus("portalAccessStatus", candidate.portalAccessStatus || "Not Created");
    setStatus("documentDownloadStatus", candidate.documentDownloadStatus || "Not Available");
    setStatus("contractAcceptanceStatus", candidate.contractAcceptanceStatus || "Not Sent");
    setStatus("eSignatureStatus", candidate.eSignatureStatus || "Not Required");
    setStatus("selfServiceStatus", candidate.selfServiceStatus || "Not Enabled");
    setText("portalAccessDate", formatDate(candidate.portalAccessDate));
    setText("portalAccessNotes", candidate.portalAccessNotes || "No portal notes have been added yet.");

    setText("lastCommunicationAction", candidate.lastCommunicationAction || "No recent communication recorded.");
    setText("lastCommunicationAt", formatDate(candidate.lastCommunicationAt));
}


function updateInterviewResponseControls(responseValue) {
    const response = String(responseValue || "").toLowerCase();
    const hasResponded = response.includes("accepted") || response.includes("declined");

    if (interviewResponseActions) {
        interviewResponseActions.style.display = hasResponded ? "none" : "flex";
    }

    if (interviewResponseMessage) {
        if (response.includes("accepted")) {
            interviewResponseMessage.textContent = "Your interview attendance has been confirmed.";
            interviewResponseMessage.style.color = "#7dffad";
        } else if (response.includes("declined")) {
            interviewResponseMessage.textContent = "You have declined this interview invitation.";
            interviewResponseMessage.style.color = "#ff9a9a";
        } else {
            interviewResponseMessage.textContent = "";
        }
    }
}

async function submitInterviewResponse(responseValue) {
    const token = getCandidateToken();

    if (!token) {
        showLogin("Please sign in again.");
        return;
    }

    const isDecline = responseValue === "declined";

    if (isDecline && !window.confirm("Are you sure you want to decline this interview invitation?")) {
        return;
    }

    if (acceptInterviewBtn) acceptInterviewBtn.disabled = true;
    if (declineInterviewBtn) declineInterviewBtn.disabled = true;

    if (interviewResponseMessage) {
        interviewResponseMessage.textContent = isDecline ? "Declining interview..." : "Confirming interview...";
        interviewResponseMessage.style.color = "#ffffff";
    }

    try {
        const response = await fetch("/api/candidate/interview-response", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ response: responseValue })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to save interview response.");
        }

        renderCandidate(result.candidate);
    } catch (error) {
        if (interviewResponseMessage) {
            interviewResponseMessage.textContent = error.message || "Failed to save interview response.";
            interviewResponseMessage.style.color = "#ff9a9a";
        }

        if (acceptInterviewBtn) acceptInterviewBtn.disabled = false;
        if (declineInterviewBtn) declineInterviewBtn.disabled = false;
    }
}

function logoutCandidate() {
    localStorage.removeItem(CANDIDATE_TOKEN_KEY);
    localStorage.removeItem(CANDIDATE_EMAIL_KEY);
    candidateEmailInput.value = "";
    showLogin("You have been logged out.");
}

if (loginForm) {
    loginForm.addEventListener("submit", candidateLogin);
}

if (logoutCandidateBtn) {
    logoutCandidateBtn.addEventListener("click", logoutCandidate);
}

if (refreshCandidateBtn) {
    refreshCandidateBtn.addEventListener("click", loadCandidateProfile);
}

if (acceptInterviewBtn) {
    acceptInterviewBtn.addEventListener("click", function () {
        submitInterviewResponse("accepted");
    });
}

if (declineInterviewBtn) {
    declineInterviewBtn.addEventListener("click", function () {
        submitInterviewResponse("declined");
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const savedEmail = localStorage.getItem(CANDIDATE_EMAIL_KEY) || "";
    if (savedEmail && candidateEmailInput) {
        candidateEmailInput.value = savedEmail;
    }

    loadCandidateProfile();
});
