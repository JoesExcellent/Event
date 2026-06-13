/* =====================================================
   JOE'S EXCELLENT EVENTS & MANAGEMENT
   PHASE 5A.1 - CANDIDATE SELF-SERVICE PORTAL
===================================================== */

const CANDIDATE_TOKEN_KEY = "temcCandidateToken";
const CANDIDATE_EMAIL_KEY = "temcCandidateEmail";
const CANDIDATE_REFERENCE_KEY = "temcCandidateReference";

const loginSection = document.getElementById("candidateLoginSection");
const dashboardSection = document.getElementById("candidateDashboardSection");
const loginForm = document.getElementById("candidateLoginForm");
const candidateEmailInput = document.getElementById("candidateEmail");
const applicationReferenceInput = document.getElementById("applicationReference");
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

function getPortalRefreshMessageElement() {
    let element = document.getElementById("portalRefreshMessage");

    if (!element && refreshCandidateBtn && refreshCandidateBtn.parentElement) {
        element = document.createElement("p");
        element.id = "portalRefreshMessage";
        element.className = "response-message";
        element.style.marginTop = "16px";
        refreshCandidateBtn.parentElement.appendChild(element);
    }

    return element;
}

function setPortalRefreshMessage(message, color = "#7dffad") {
    const element = getPortalRefreshMessageElement();

    if (element) {
        element.textContent = message;
        element.style.color = color;
    }
}

async function candidateLogin(event) {
    event.preventDefault();

    const email = candidateEmailInput.value.trim();
    const applicationReference = applicationReferenceInput ? applicationReferenceInput.value.trim() : "";

    if (!email) {
        candidateLoginMessage.textContent = "Please enter your email address.";
        candidateLoginMessage.style.color = "#ff6a00";
        return;
    }

    if (!applicationReference) {
        candidateLoginMessage.textContent = "Please enter your application reference.";
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
            body: JSON.stringify({ email, applicationReference })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Candidate login failed.");
        }

        localStorage.setItem(CANDIDATE_TOKEN_KEY, result.token);
        localStorage.setItem(CANDIDATE_EMAIL_KEY, email);
        localStorage.setItem(CANDIDATE_REFERENCE_KEY, applicationReference);

        renderCandidate(result.candidate);
        showDashboard();
    } catch (error) {
        candidateLoginMessage.textContent = error.message || "We could not find your application. Please check your email address.";
        candidateLoginMessage.style.color = "#ff6a00";
    }
}

async function loadCandidateProfile(showRefreshFeedback = false) {
    const token = getCandidateToken();

    if (!token) {
        showLogin();
        return;
    }

    if (showRefreshFeedback && refreshCandidateBtn) {
        refreshCandidateBtn.disabled = true;
        refreshCandidateBtn.textContent = "Refreshing...";
        setPortalRefreshMessage("Refreshing portal...", "#ffffff");
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

        if (showRefreshFeedback) {
            setPortalRefreshMessage("Portal refreshed successfully.", "#7dffad");
        }
    } catch (error) {
        if (showRefreshFeedback) {
            setPortalRefreshMessage(error.message || "Portal refresh failed. Please try again.", "#ff9a9a");
        } else {
            localStorage.removeItem(CANDIDATE_TOKEN_KEY);
            showLogin(error.message || "Please sign in again.");
        }
    } finally {
        if (showRefreshFeedback && refreshCandidateBtn) {
            refreshCandidateBtn.disabled = false;
            refreshCandidateBtn.textContent = "Refresh Portal";
        }
    }
}

function renderCandidate(candidate) {
    if (!candidate) return;

    setText("welcomeCandidateName", candidate.fullName || candidate.name || "Candidate");
    const applicationReference = candidate.applicationReference || candidate.id || "";
    const maskedApplicationReference = applicationReference.length > 4
        ? "••••••••••••" + applicationReference.slice(-4)
        : "••••";

    setText("applicationReferenceDisplay", maskedApplicationReference);
    setText("applicationName", candidate.fullName || candidate.name || "Candidate");
    setText("applicationEmail", candidate.email);
    setText("applicationPhone", candidate.phone);
    setText("applicationPosition", candidate.position);
    setText("applicationAvailability", candidate.availability);
    setText("applicationDate", formatDate(candidate.createdAt));
    const mainApplicationStatus =
        candidate.status === "Hired" || candidate.employmentStatus === "Hired"
            ? "Hired"
            : candidate.status === "Offer Accepted" || candidate.offerResponseStatus === "Offer Accepted"
                ? "Offer Accepted"
                : candidate.interviewResponse === "Interview Accepted" || candidate.interviewResponse === "Interview Declined"
                    ? candidate.interviewResponse
                    : candidate.interviewStatus === "Interview Accepted" || candidate.interviewStatus === "Interview Declined"
                        ? candidate.interviewStatus
                        : candidate.status;

    setStatus("applicationStatus", mainApplicationStatus);

    setText("interviewDate", formatDate(candidate.interviewDate));
    setText("interviewTime", candidate.interviewTime || "N/A");
    setText("interviewLocation", candidate.interviewLocation || "N/A");

    const interviewStatusValue = candidate.interviewStatus || (candidate.invitationSent ? "Interview Invitation Sent" : candidate.status || "Not Scheduled");
    const interviewResponseValue = candidate.interviewResponse || "Pending";

    setStatus("interviewStatus", interviewStatusValue);
    setStatus("interviewResponseStatus", interviewResponseValue);
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

    setStatus("employmentStatus", candidate.employmentStatus || (candidate.status === "Hired" ? "Hired" : "Pending"));
    setStatus("employmentConfirmationStatus", candidate.employmentConfirmationStatus || (candidate.hiredEmailSent ? "Confirmation Sent" : "Awaiting Confirmation"));
    setText("hireDate", formatDate(candidate.hireDate || candidate.hiredAt));
    setText("employmentNotes", candidate.employmentNotes || "Employment notes will appear here after hiring confirmation.");


    const employmentDocumentAssignment = candidate.employmentDocumentAssignment || {};
    const hasEmploymentContract = Boolean(employmentDocumentAssignment.employmentContractDocumentId || employmentDocumentAssignment.employmentContract);
    const hasWelcomePack = Boolean(employmentDocumentAssignment.welcomePackDocumentId || employmentDocumentAssignment.welcomePack);
    const hasHandbook = Boolean(employmentDocumentAssignment.handbookDocumentId || employmentDocumentAssignment.employeeHandbook || employmentDocumentAssignment.handbook);
    const hasInductionPack = Boolean(employmentDocumentAssignment.inductionPackDocumentId || employmentDocumentAssignment.inductionPack);
    const hasCompanyPolicies = Boolean(employmentDocumentAssignment.companyPoliciesDocumentId || employmentDocumentAssignment.companyPolicies);

    setStatus("candidateEmploymentContractStatus", hasEmploymentContract ? "Available" : "Not Available");
    setStatus("candidateWelcomePackStatus", hasWelcomePack ? "Available" : "Not Available");
    setStatus("candidateHandbookStatus", hasHandbook ? "Available" : "Not Available");
    setStatus("candidateInductionPackStatus", hasInductionPack ? "Available" : "Not Available");
    setStatus("candidatePoliciesStatus", hasCompanyPolicies ? "Available" : "Not Available");

    const availableDocumentCount = [hasEmploymentContract, hasWelcomePack, hasHandbook, hasInductionPack, hasCompanyPolicies].filter(Boolean).length;
    const documentNote = availableDocumentCount
        ? `${availableDocumentCount} employment document${availableDocumentCount === 1 ? " is" : "s are"} available. Secure downloads will be added in the next phase.`
        : "Employment documents have not yet been assigned by the recruitment team.";
    setText("candidateEmploymentDocumentNote", documentNote);

    setText("lastCommunicationAction", candidate.lastCommunicationAction || "No recent communication recorded.");
    setText("lastCommunicationAt", formatDate(candidate.lastCommunicationAt));
}


function updateInterviewResponseControls(responseValue) {
    const response = String(responseValue || "").toLowerCase();
    const hasAccepted = response.includes("accepted");
    const hasDeclined = response.includes("declined");

    if (interviewResponseActions) {
        interviewResponseActions.style.display = "grid";
    }

    if (acceptInterviewBtn) {
        acceptInterviewBtn.disabled = false;
        acceptInterviewBtn.style.display = hasAccepted ? "none" : "inline-block";
    }

    if (declineInterviewBtn) {
        declineInterviewBtn.disabled = false;
        declineInterviewBtn.style.display = hasDeclined ? "none" : "inline-block";
    }

    if (interviewResponseMessage) {
        if (hasAccepted) {
            interviewResponseMessage.textContent = "Your interview attendance has been confirmed. If your circumstances change, you can decline this interview using the button above.";
            interviewResponseMessage.style.color = "#7dffad";
        } else if (hasDeclined) {
            interviewResponseMessage.textContent = "You have declined this interview invitation. If your circumstances change, you can accept this interview using the button above.";
            interviewResponseMessage.style.color = "#ff9a9a";
        } else {
            interviewResponseMessage.textContent = "Please confirm whether you can attend this interview.";
            interviewResponseMessage.style.color = "#ffcc66";
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
    const isAccept = responseValue === "accepted";

    if (isDecline && !window.confirm("Are you sure you want to decline this interview invitation?")) {
        return;
    }

    if (isAccept && !window.confirm("Are you sure you want to accept this interview invitation?")) {
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
    localStorage.removeItem(CANDIDATE_REFERENCE_KEY);
    candidateEmailInput.value = "";
    if (applicationReferenceInput) applicationReferenceInput.value = "";
    showLogin("You have been logged out.");
}

if (loginForm) {
    loginForm.addEventListener("submit", candidateLogin);
}

if (logoutCandidateBtn) {
    logoutCandidateBtn.addEventListener("click", logoutCandidate);
}

if (refreshCandidateBtn) {
    refreshCandidateBtn.addEventListener("click", function () {
        loadCandidateProfile(true);
    });
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
    const savedReference = localStorage.getItem(CANDIDATE_REFERENCE_KEY) || "";

    if (savedEmail && candidateEmailInput) {
        candidateEmailInput.value = savedEmail;
    }

    if (savedReference && applicationReferenceInput) {
        applicationReferenceInput.value = savedReference;
    }

    loadCandidateProfile();
});
