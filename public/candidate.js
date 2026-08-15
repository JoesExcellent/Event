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
const acceptOfferBtn = document.getElementById("acceptOfferBtn");
const declineOfferBtn = document.getElementById("declineOfferBtn");
const offerResponseActions = document.getElementById("offerResponseActions");
const offerResponseMessage = document.getElementById("offerResponseMessage");
let currentCandidateProfile = null;

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

function setDocumentName(id, documentRecord, documentLabel = "Employment Document") {
    const element = document.getElementById(id);
    if (!element) return;

    element.innerHTML = "";

    if (documentRecord && documentRecord.documentName) {
        const uploadedText = documentRecord.uploadedAt ? `Uploaded ${formatDate(documentRecord.uploadedAt)}` : "Assigned document";

        const nameLine = document.createElement("div");
        nameLine.textContent = `${documentRecord.documentName} — ${uploadedText}`;
        nameLine.style.color = "#f2f2f2";
        nameLine.style.marginBottom = "10px";
        element.appendChild(nameLine);

        const actionBox = document.createElement("div");
        actionBox.className = "interview-action-buttons";
        actionBox.style.marginTop = "8px";

        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "btn";
        viewButton.textContent = "View Document";
        viewButton.addEventListener("click", function () {
            accessEmploymentDocument(documentRecord.id, "view", documentLabel);
        });

        const downloadButton = document.createElement("button");
        downloadButton.type = "button";
        downloadButton.className = "btn btn-secondary";
        downloadButton.textContent = "Download Document";
        downloadButton.addEventListener("click", function () {
            accessEmploymentDocument(documentRecord.id, "download", documentLabel);
        });

        actionBox.appendChild(viewButton);
        actionBox.appendChild(downloadButton);
        element.appendChild(actionBox);
    } else {
        element.textContent = "No document record assigned";
        element.style.color = "rgba(255, 255, 255, 0.65)";
    }
}

async function accessEmploymentDocument(documentId, action = "view", documentLabel = "Employment Document") {
    const token = getCandidateToken();

    if (!token) {
        showLogin("Please sign in again to access your document.");
        return;
    }

    if (!documentId) {
        setPortalRefreshMessage("This document is not available yet.", "#ff9a9a");
        return;
    }

    const accessAction = action === "download" ? "download" : "view";
    const actionText = accessAction === "download" ? "Preparing secure download" : "Opening secure view";

    try {
        setPortalRefreshMessage(`${actionText} for ${documentLabel}...`, "#ffffff");

        const response = await fetch(`/api/candidate/employment-document/${encodeURIComponent(documentId)}/access?action=${encodeURIComponent(accessAction)}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const contentType = response.headers.get("content-type") || "";

        if (!response.ok) {
            if (contentType.includes("application/json")) {
                const result = await response.json();
                throw new Error(result.message || "Unable to access this document.");
            }
            throw new Error("Unable to access this document.");
        }

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        if (accessAction === "download") {
            const downloadLink = document.createElement("a");
            downloadLink.href = blobUrl;
            downloadLink.download = `${String(documentLabel || "employment-document").replace(/[^a-z0-9]+/gi, "-")}.txt`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            window.setTimeout(function () {
                window.URL.revokeObjectURL(blobUrl);
            }, 1000);
            setPortalRefreshMessage(`${documentLabel} secure download recorded.`, "#7dffad");
        } else {
            window.open(blobUrl, "_blank", "noopener,noreferrer");
            window.setTimeout(function () {
                window.URL.revokeObjectURL(blobUrl);
            }, 60000);
            setPortalRefreshMessage(`${documentLabel} secure view recorded.`, "#7dffad");
        }
    } catch (error) {
        console.error(error);
        setPortalRefreshMessage(error.message || "Unable to access this document.", "#ff9a9a");
    }
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
    currentCandidateProfile = candidate;

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
    updateOfferResponseControls(candidate);
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
    const hasCompanyPolicies = Boolean(employmentDocumentAssignment.companyPoliciesDocumentId || employmentDocumentAssignment.companyPolicies);

    setStatus("candidateEmploymentContractStatus", hasEmploymentContract ? "Available" : "Not Available");
    setStatus("candidateWelcomePackStatus", hasWelcomePack ? "Available" : "Not Available");
    setStatus("candidateHandbookStatus", hasHandbook ? "Available" : "Not Available");
    setStatus("candidatePoliciesStatus", hasCompanyPolicies ? "Available" : "Not Available");

    const assignedDocuments = employmentDocumentAssignment.assignedDocuments || {};
    setDocumentName("candidateEmploymentContractName", assignedDocuments.employmentContract, "Employment Contract");
    setDocumentName("candidateWelcomePackName", assignedDocuments.welcomePack, "Welcome Pack");
    setDocumentName("candidateHandbookName", assignedDocuments.employeeHandbook, "Employee Handbook");
    setDocumentName("candidatePoliciesName", assignedDocuments.companyPolicies, "Company Policies");

    const availableDocumentCount = [hasEmploymentContract, hasWelcomePack, hasHandbook, hasCompanyPolicies].filter(Boolean).length;
    const resolvedDocumentCount = Object.values(assignedDocuments).filter(Boolean).length;
    const documentNote = availableDocumentCount
        ? `${availableDocumentCount} employment document${availableDocumentCount === 1 ? " is" : "s are"} available. ${resolvedDocumentCount ? "Document names are now shown above." : "Document names will appear after the document records are resolved."} Contract acceptance and electronic signature actions are available below when a contract is assigned.`
        : "Employment documents have not yet been assigned by the recruitment team.";
    setText("candidateEmploymentDocumentNote", documentNote);
    renderContractAcceptanceCentre(candidate, hasEmploymentContract);

    setText("lastCommunicationAction", candidate.lastCommunicationAction || "No recent communication recorded.");
    setText("lastCommunicationAt", formatDate(candidate.lastCommunicationAt));
}


function getContractAcceptanceCentre() {
    let panel = document.getElementById("contractAcceptanceCentrePanel");
    const note = document.getElementById("candidateEmploymentDocumentNote");

    if (!panel && note && note.parentElement) {
        panel = document.createElement("div");
        panel.id = "contractAcceptanceCentrePanel";
        panel.className = "info-row";
        panel.style.gridColumn = "1 / -1";
        panel.innerHTML = `
            <div class="info-label">Contract Acceptance</div>
            <div class="info-value">
                <p id="contractAcceptanceCentreMessage" class="response-message" style="margin-bottom:12px;"></p>
                <div id="contractAcceptanceActions" class="interview-action-buttons" style="margin-bottom:12px;"></div>
                <div id="electronicSignatureBox" style="margin-top:12px; display:none;">
                    <label for="electronicSignatureName">Electronic Signature Name</label>
                    <input type="text" id="electronicSignatureName" placeholder="Enter your full legal name">
                    <button type="button" id="submitElectronicSignatureBtn" class="btn">Submit Electronic Signature</button>
                </div>
            </div>
        `;
        note.parentElement.insertAdjacentElement("afterend", panel);
    }

    return panel;
}

function renderContractAcceptanceCentre(candidate, hasEmploymentContract) {
    const panel = getContractAcceptanceCentre();
    if (!panel) return;

    const message = document.getElementById("contractAcceptanceCentreMessage");
    const actions = document.getElementById("contractAcceptanceActions");
    const signatureBox = document.getElementById("electronicSignatureBox");
    const signatureName = document.getElementById("electronicSignatureName");

    const contractAcceptance = candidate.contractAcceptanceStatus || "Not Sent";
    const signatureStatus = candidate.eSignatureStatus || "Not Required";
    const accepted = String(contractAcceptance).toLowerCase().includes("accepted");
    const declined = String(contractAcceptance).toLowerCase().includes("declined");
    const signed = String(signatureStatus).toLowerCase().includes("signed");

    if (!hasEmploymentContract) {
        panel.style.display = "none";
        return;
    }

    panel.style.display = "grid";

    if (message) {
        if (signed) {
            message.textContent = `Electronic signature submitted${candidate.eSignatureSubmittedAt ? " on " + formatDate(candidate.eSignatureSubmittedAt) : ""}.`;
            message.style.color = "#7dffad";
        } else if (accepted) {
            message.textContent = "Your contract has been accepted. You may now submit your electronic signature.";
            message.style.color = "#7dffad";
        } else if (declined) {
            message.textContent = "You have declined the contract. The recruitment team will review this response.";
            message.style.color = "#ff9a9a";
        } else {
            message.textContent = "Please review your contract information. You can accept, decline, or submit your electronic signature.";
            message.style.color = "#ffcc66";
        }
    }

    if (actions) {
        if (signed) {
            actions.innerHTML = `
                <div class="response-message" style="color:#7dffad; font-weight:bold; line-height:1.5;">
                    Contract completed and electronic signature received. No further contract action is required.
                </div>
            `;
        } else if (declined) {
            actions.innerHTML = `
                <div class="response-message" style="color:#ff9a9a; font-weight:bold; line-height:1.5;">
                    Contract declined. The recruitment team will review this response.
                </div>
            `;
        } else {
            actions.innerHTML = `
                <button type="button" id="acceptContractBtn" class="btn" ${accepted ? "disabled" : ""}>Accept Contract</button>
                <button type="button" id="declineContractBtn" class="btn btn-danger">Decline Contract</button>
            `;

            document.getElementById("acceptContractBtn")?.addEventListener("click", function () {
                submitContractAction("accept");
            });

            document.getElementById("declineContractBtn")?.addEventListener("click", function () {
                submitContractAction("decline");
            });
        }
    }

    if (signatureBox) {
        signatureBox.style.display = declined || signed ? "none" : "block";
    }

    if (signatureName) {
        signatureName.value = candidate.eSignatureName || signatureName.value || "";
    }

    const submitElectronicSignatureBtn = document.getElementById("submitElectronicSignatureBtn");
    if (submitElectronicSignatureBtn && !declined && !signed) {
        submitElectronicSignatureBtn.addEventListener("click", function () {
            submitContractAction("signature");
        });
    }
}

async function submitContractAction(action) {
    const token = getCandidateToken();

    if (!token) {
        showLogin("Please sign in again.");
        return;
    }

    const actionLabels = {
        accept: "accept this contract",
        decline: "decline this contract",
        signature: "submit your electronic signature"
    };

    if (!window.confirm(`Are you sure you want to ${actionLabels[action] || "continue"}?`)) {
        return;
    }

    const signatureName = document.getElementById("electronicSignatureName")?.value.trim() || "";
    if (action === "signature" && !signatureName) {
        setPortalRefreshMessage("Please enter your full legal name before submitting your electronic signature.", "#ff9a9a");
        return;
    }

    const endpointMap = {
        accept: "/api/candidate/contract-accept",
        decline: "/api/candidate/contract-decline",
        signature: "/api/candidate/e-signature"
    };

    try {
        setPortalRefreshMessage("Saving contract response...", "#ffffff");

        const response = await fetch(endpointMap[action], {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ signatureName })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to save contract response.");
        }

        renderCandidate(result.candidate);
        setPortalRefreshMessage(result.message || "Contract response saved.", "#7dffad");
    } catch (error) {
        console.error(error);
        setPortalRefreshMessage(error.message || "Failed to save contract response.", "#ff9a9a");
    }
}


function updateOfferResponseControls(candidate) {
    const offerResponse = String(candidate?.offerResponseStatus || "").toLowerCase();
    const applicationStatus = String(candidate?.status || "").toLowerCase();

    const offerExists =
        offerResponse.includes("offer pending") ||
        offerResponse.includes("offer accepted") ||
        offerResponse.includes("offer declined") ||
        applicationStatus === "offer made" ||
        applicationStatus === "offer accepted" ||
        applicationStatus === "offer declined";

    const accepted = offerResponse.includes("accepted") || applicationStatus === "offer accepted";
    const declined = offerResponse.includes("declined") || applicationStatus === "offer declined";
    const pending = offerExists && !accepted && !declined;

    if (offerResponseActions) {
        offerResponseActions.style.display = offerExists ? "grid" : "none";
    }

    if (!offerExists) {
        return;
    }

    if (acceptOfferBtn) {
        acceptOfferBtn.disabled = false;
        acceptOfferBtn.style.display = pending ? "inline-block" : "none";
    }

    if (declineOfferBtn) {
        declineOfferBtn.disabled = false;
        declineOfferBtn.style.display = pending ? "inline-block" : "none";
    }

    if (offerResponseMessage) {
        if (accepted) {
            offerResponseMessage.textContent = "You have accepted this conditional offer of employment. The recruitment team will now continue the hiring process.";
            offerResponseMessage.style.color = "#7dffad";
        } else if (declined) {
            offerResponseMessage.textContent = "You have declined this conditional offer of employment. The recruitment team has been notified.";
            offerResponseMessage.style.color = "#ff9a9a";
        } else {
            offerResponseMessage.textContent = "A conditional offer of employment has been made to you. Please accept or decline the offer below.";
            offerResponseMessage.style.color = "#ffcc66";
        }
    }
}

async function submitOfferResponse(responseValue) {
    const token = getCandidateToken();

    if (!token) {
        showLogin("Please sign in again.");
        return;
    }

    const isDecline = responseValue === "declined";
    const isAccept = responseValue === "accepted";

    if (isDecline && !window.confirm("Are you sure you want to decline this conditional offer of employment?")) {
        return;
    }

    if (isAccept && !window.confirm("Are you sure you want to accept this conditional offer of employment?")) {
        return;
    }

    if (acceptOfferBtn) acceptOfferBtn.disabled = true;
    if (declineOfferBtn) declineOfferBtn.disabled = true;

    if (offerResponseMessage) {
        offerResponseMessage.textContent = isDecline ? "Declining offer..." : "Accepting offer...";
        offerResponseMessage.style.color = "#ffffff";
    }

    try {
        const response = await fetch("/api/candidate/offer-response", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ response: responseValue })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to save offer response.");
        }

        renderCandidate(result.candidate);
        setPortalRefreshMessage(result.message || "Offer response saved successfully.", "#7dffad");
    } catch (error) {
        console.error(error);

        if (offerResponseMessage) {
            offerResponseMessage.textContent = error.message || "Failed to save offer response.";
            offerResponseMessage.style.color = "#ff9a9a";
        }

        if (acceptOfferBtn) acceptOfferBtn.disabled = false;
        if (declineOfferBtn) declineOfferBtn.disabled = false;
    }
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

if (acceptOfferBtn) {
    acceptOfferBtn.addEventListener("click", function () {
        submitOfferResponse("accepted");
    });
}

if (declineOfferBtn) {
    declineOfferBtn.addEventListener("click", function () {
        submitOfferResponse("declined");
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