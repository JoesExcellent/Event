const API_BASE = "";

let authToken = localStorage.getItem("adminToken") || "";
let adminRole = localStorage.getItem("adminRole") || "";
let selectedApplicationId = null;
let selectedContactMessageId = null;

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

function showToast(message, type = "info") {

    const toastContainer = document.getElementById("toastContainer");

    const toast = document.createElement("div");

    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function setDashboardVisible(show) {

    loginBox.style.display = show ? "none" : "block";
    dashboardContent.style.display = show ? "block" : "none";
}

function getAuthHeaders() {

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
    };
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

        adminInfo.innerHTML = `
            <h3>Logged In As: ${adminRole.toUpperCase()}</h3>
        `;

        permissionsInfo.innerHTML = `
            <strong>Permissions:</strong>
            ${adminRole === "viewer"
                ? "View-only access enabled."
                : "Full recruitment management access enabled."}
        `;

        setDashboardVisible(true);

        await loadApplications();
        await loadContactMessages();

    } catch (error) {

        console.error(error);

        loginMessage.style.color = "#ff6b6b";
        loginMessage.textContent = error.message || "Login failed.";

        showToast(error.message, "error");
    }
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

        renderApplications(result.applications || []);
        updateStats(result.applications || []);

    } catch (error) {

        console.error(error);

        applicationsTableBody.innerHTML = `
            <tr>
                <td colspan="7">Failed to load applications.</td>
            </tr>
        `;

        showToast(error.message, "error");
    }
}

function renderApplications(applications) {

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

        tr.innerHTML = `
            <td>${application.fullName || ""}</td>
            <td>${application.email || ""}</td>
            <td>${application.position || ""}</td>
            <td>${formatDate(application.createdAt)}</td>
            <td>${application.status || "New"}</td>
            <td>
                ${application.cv
                    ? `<a href="${application.cv}" target="_blank">Download CV</a>`
                    : "No CV"}
            </td>
            <td>
                <button onclick="selectCandidate('${application.id}', '${escapeQuotes(application.fullName)}')">
                    Interview
                </button>

                <button onclick="deleteApplication('${application.id}')">
                    Delete
                </button>
            </td>
        `;

        applicationsTableBody.appendChild(tr);
    });
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

        renderContactMessages(result.messages || []);

    } catch (error) {

        console.error(error);

        contactMessagesTableBody.innerHTML = `
            <tr>
                <td colspan="7">Failed to load contact messages.</td>
            </tr>
        `;

        showToast(error.message, "error");
    }
}

function renderContactMessages(messages) {

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

        tr.innerHTML = `
            <td>${message.name || ""}</td>
            <td>${message.email || ""}</td>
            <td>${message.phone || ""}</td>
            <td>${message.subject || ""}</td>
            <td>${formatDate(message.createdAt)}</td>
            <td>${message.read ? "Read" : "New"}</td>
            <td>

                <button onclick="viewContactMessage(
                    '${message.id}',
                    '${escapeQuotes(message.name)}',
                    '${escapeQuotes(message.email)}',
                    '${escapeQuotes(message.subject)}',
                    '${escapeQuotes(message.message)}'
                )">
                    View
                </button>

                <button onclick="markMessageRead('${message.id}')">
                    Mark Read
                </button>

                <button onclick="deleteContactMessage('${message.id}')">
                    Delete
                </button>

            </td>
        `;

        contactMessagesTableBody.appendChild(tr);
    });
}

function viewContactMessage(id, name, email, subject, message) {

    selectedContactMessageId = id;

    alert(
        `Name: ${name}\n\n` +
        `Email: ${email}\n\n` +
        `Subject: ${subject}\n\n` +
        `Message:\n${message}`
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

        showToast(error.message, "error");
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

        showToast(error.message, "error");
    }
}

function updateStats(applications) {

    totalApplications.textContent = applications.length;

    const newCount = applications.filter(app =>
        (app.status || "").toLowerCase().includes("new")
    ).length;

    const interviewCount = applications.filter(app =>
        (app.status || "").toLowerCase().includes("interview")
    ).length;

    const hiredCount = applications.filter(app =>
        (app.status || "").toLowerCase().includes("hired")
    ).length;

    newApplications.textContent = newCount;
    interviewApplications.textContent = interviewCount;
    hiredApplications.textContent = hiredCount;
}

function selectCandidate(id, fullName) {

    selectedApplicationId = id;

    document.getElementById("candidateName").value = fullName;
    document.getElementById("selectedCandidate").value = fullName;

    showToast(`Selected ${fullName}`, "info");
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

        showToast(error.message, "error");
    }
}

async function sendInvitation() {

    if (!selectedApplicationId) {
        showToast("Please select a candidate first.", "error");
        return;
    }

    try {

        const payload = {
            interviewDate: document.getElementById("interviewDate").value,
            interviewTime: document.getElementById("interviewTime").value,
            interviewLocation: document.getElementById("interviewLocation").value,
            interviewMessage: document.getElementById("interviewMessage").value
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

        showToast(error.message, "error");
    }
}

function exportApplicationsCSV() {

    showToast("CSV export started.", "info");

    const rows = [];

    const tableRows = applicationsTableBody.querySelectorAll("tr");

    tableRows.forEach(row => {

        const cols = row.querySelectorAll("td");

        if (!cols.length) return;

        const rowData = [];

        cols.forEach((col, index) => {

            if (index < 5) {
                rowData.push(`"${col.innerText.replace(/"/g, '""')}"`);
            }
        });

        rows.push(rowData.join(","));
    });

    const csvContent = [
        `"Name","Email","Position","Date Applied","Status"`,
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
}

function logoutAdmin() {

    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");

    authToken = "";
    adminRole = "";

    setDashboardVisible(false);

    showToast("Logged out successfully.", "success");
}

function formatDate(dateString) {

    if (!dateString) return "N/A";

    const date = new Date(dateString);

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function escapeQuotes(value) {

    return String(value || "")
        .replace(/'/g, "\\'")
        .replace(/"/g, "&quot;");
}

document.getElementById("sendInvitationBtn")
    .addEventListener("click", sendInvitation);

document.getElementById("logoutBtn")
    .addEventListener("click", logoutAdmin);

document.getElementById("exportCsvBtn")
    .addEventListener("click", exportApplicationsCSV);

window.loginAdmin = loginAdmin;
window.deleteApplication = deleteApplication;
window.selectCandidate = selectCandidate;
window.deleteContactMessage = deleteContactMessage;
window.markMessageRead = markMessageRead;
window.viewContactMessage = viewContactMessage;

if (authToken) {

    setDashboardVisible(true);

    adminInfo.innerHTML = `
        <h3>Logged In As: ${adminRole.toUpperCase()}</h3>
    `;

    permissionsInfo.innerHTML = `
        <strong>Permissions:</strong>
        ${adminRole === "viewer"
            ? "View-only access enabled."
            : "Full recruitment management access enabled."}
    `;

    loadApplications();
    loadContactMessages();
}