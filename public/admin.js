/* =====================================================
   TEMC RECRUITMENT ADMIN DASHBOARD
   Railway + Firebase Ready
   Includes Interview Calendar Scheduling
===================================================== */

const API_BASE_URL = "https://event-production-111a.up.railway.app";

const loginBox = document.getElementById("loginBox");
const dashboardContent = document.getElementById("dashboardContent");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const loginMessage = document.getElementById("loginMessage");
const applicationsContainer = document.getElementById("applications");
const statsContainer = document.getElementById("stats");
const adminInfo = document.getElementById("adminInfo");

let allApplications = [];

/* =====================================================
   TOKEN HELPERS
===================================================== */

function getToken() {
    return localStorage.getItem("adminToken");
}

function setToken(token) {
    localStorage.setItem("adminToken", token);
}

function clearToken() {
    localStorage.removeItem("adminToken");
}

/* =====================================================
   SAFE API FETCH
===================================================== */

async function fetchJSON(path, options = {}) {
    const fullUrl = path.startsWith("http")
        ? path
        : `${API_BASE_URL}${path}`;

    const response = await fetch(fullUrl, options);
    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch (error) {
        throw new Error(
            `Server returned non-JSON response from ${fullUrl}. Response: ${text.slice(0, 160)}`
        );
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

/* =====================================================
   DISPLAY HELPERS
===================================================== */

function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(value) {
    if (!value) return "Not set";

    if (value._seconds) {
        return new Date(value._seconds * 1000).toLocaleString();
    }

    const date = new Date(value);
    return isNaN(date.getTime()) ? "Not set" : date.toLocaleString();
}

function formatInterviewDate(dateValue) {
    if (!dateValue) return "Not set";

    const date = new Date(`${dateValue}T00:00:00`);

    if (isNaN(date.getTime())) {
        return dateValue;
    }

    return date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatInterviewTime(timeValue) {
    if (!timeValue) return "Not set";
    return timeValue;
}

function showToast(message, type = "info") {
    let toastContainer = document.getElementById("toastContainer");

    if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.id = "toastContainer";
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

/* =====================================================
   LOGIN
===================================================== */

if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value.trim();

        if (!email || !password) {
            loginMessage.textContent = "Please enter admin email and password.";
            return;
        }

        loginMessage.textContent = "Logging in...";

        try {
            const result = await fetchJSON("/api/admin/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            if (result.success && result.token) {
                setToken(result.token);

                loginBox.style.display = "none";
                dashboardContent.style.display = "block";

                adminInfo.innerHTML = `
                    <p>Logged in as: <strong>${escapeHTML(email)}</strong></p>
                `;

                loginMessage.textContent = "";

                await loadApplications();
            } else {
                loginMessage.textContent = result.message || "Invalid login details.";
            }

        } catch (error) {
            console.error("Login error:", error);
            loginMessage.textContent = error.message || "Login failed.";
        }
    });
}

/* =====================================================
   LOGOUT
===================================================== */

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        clearToken();

        allApplications = [];

        loginBox.style.display = "block";
        dashboardContent.style.display = "none";

        adminInfo.innerHTML = "";
        statsContainer.innerHTML = "";
        applicationsContainer.innerHTML = "";

        loginMessage.textContent = "Logged out.";
    });
}

/* =====================================================
   LOAD APPLICATIONS
===================================================== */

async function loadApplications() {
    const token = getToken();

    if (!token) {
        loginBox.style.display = "block";
        dashboardContent.style.display = "none";
        return;
    }

    applicationsContainer.innerHTML = "<p>Loading applications...</p>";

    try {
        const result = await fetchJSON("/api/admin/applications", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        allApplications = result.applications || [];

        renderStats();
        renderInterviewCalendar();
        renderApplications(allApplications);

    } catch (error) {
        console.error("Load applications error:", error);

        applicationsContainer.innerHTML = `
            <p class="error-message">
                ${escapeHTML(error.message)}
            </p>
        `;
    }
}

/* =====================================================
   STATS
===================================================== */

function renderStats() {
    const total = allApplications.length;

    const newCount = allApplications.filter(app =>
        app.status === "New"
    ).length;

    const reviewedCount = allApplications.filter(app =>
        app.status === "Reviewed"
    ).length;

    const interviewCount = allApplications.filter(app =>
        app.status === "To Be Interviewed" ||
        app.status === "Interview Invited"
    ).length;

    const scheduledCount = allApplications.filter(app =>
        app.interviewDate && app.interviewTime
    ).length;

    statsContainer.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Applications</h3>
                <p>${total}</p>
            </div>

            <div class="stat-card">
                <h3>New</h3>
                <p>${newCount}</p>
            </div>

            <div class="stat-card">
                <h3>Reviewed</h3>
                <p>${reviewedCount}</p>
            </div>

            <div class="stat-card">
                <h3>Interview Stage</h3>
                <p>${interviewCount}</p>
            </div>

            <div class="stat-card">
                <h3>Scheduled Interviews</h3>
                <p>${scheduledCount}</p>
            </div>
        </div>
    `;
}

/* =====================================================
   INTERVIEW CALENDAR
===================================================== */

function renderInterviewCalendar() {
    const scheduled = allApplications
        .filter(app => app.interviewDate && app.interviewTime)
        .sort((a, b) => {
            const dateA = new Date(`${a.interviewDate}T${a.interviewTime}`);
            const dateB = new Date(`${b.interviewDate}T${b.interviewTime}`);
            return dateA - dateB;
        });

    if (!scheduled.length) {
        statsContainer.innerHTML += `
            <div class="application-card">
                <h2>Interview Calendar</h2>
                <p>No interviews scheduled yet.</p>
            </div>
        `;
        return;
    }

    statsContainer.innerHTML += `
        <div class="application-card">
            <h2>Interview Calendar</h2>

            ${scheduled.map(app => `
                <div style="border-bottom:1px solid rgba(255,255,255,0.25);padding:15px 0;">
                    <strong>${escapeHTML(app.fullName || "Unnamed Candidate")}</strong><br>
                    <span>Role: ${escapeHTML(app.position || "Not set")}</span><br>
                    <span>Date: ${escapeHTML(formatInterviewDate(app.interviewDate))}</span><br>
                    <span>Time: ${escapeHTML(formatInterviewTime(app.interviewTime))}</span><br>
                    <span>Status: ${escapeHTML(app.status || "New")}</span><br>
                    ${
                        app.email
                            ? `<span>Email: ${escapeHTML(app.email)}</span><br>`
                            : ""
                    }
                </div>
            `).join("")}
        </div>
    `;
}

/* =====================================================
   RENDER APPLICATIONS
===================================================== */

function renderApplications(applications) {
    if (!applications.length) {
        applicationsContainer.innerHTML = "<p>No applications found yet.</p>";
        return;
    }

    applicationsContainer.innerHTML = applications.map(app => {
        const id = escapeHTML(app.id);

        return `
            <div class="application-card" data-id="${id}">
                <h2>${escapeHTML(app.fullName || "Unnamed Candidate")}</h2>

                <p><strong>Email:</strong> ${escapeHTML(app.email)}</p>
                <p><strong>Phone:</strong> ${escapeHTML(app.phone)}</p>
                <p><strong>Position:</strong> ${escapeHTML(app.position)}</p>
                <p><strong>About:</strong> ${escapeHTML(app.about)}</p>
                <p><strong>Status:</strong> ${escapeHTML(app.status || "New")}</p>
                <p><strong>Rating:</strong> ${escapeHTML(app.rating || 0)} / 5</p>
                <p><strong>Applied:</strong> ${formatDate(app.createdAt)}</p>

                ${
                    app.cvUrl
                        ? `<p><a href="${escapeHTML(app.cvUrl)}" target="_blank">View CV</a></p>`
                        : `<p>No CV uploaded</p>`
                }

                <label>Status</label>
                <select id="status-${id}">
                    <option value="New" ${app.status === "New" ? "selected" : ""}>New</option>
                    <option value="Reviewed" ${app.status === "Reviewed" ? "selected" : ""}>Reviewed</option>
                    <option value="To Be Interviewed" ${app.status === "To Be Interviewed" ? "selected" : ""}>To Be Interviewed</option>
                    <option value="Interview Invited" ${app.status === "Interview Invited" ? "selected" : ""}>Interview Invited</option>
                    <option value="Rejected" ${app.status === "Rejected" ? "selected" : ""}>Rejected</option>
                    <option value="Hired" ${app.status === "Hired" ? "selected" : ""}>Hired</option>
                </select>

                <label>Rating</label>
                <select id="rating-${id}">
                    ${[0, 1, 2, 3, 4, 5].map(num => `
                        <option value="${num}" ${Number(app.rating || 0) === num ? "selected" : ""}>
                            ${num}
                        </option>
                    `).join("")}
                </select>

                <label>Notes</label>
                <textarea id="notes-${id}" placeholder="Admin notes">${escapeHTML(app.notes || "")}</textarea>

                <label>Interview Date</label>
                <input type="date" id="interviewDate-${id}" value="${escapeHTML(app.interviewDate || "")}">

                <label>Interview Time</label>
                <input type="time" id="interviewTime-${id}" value="${escapeHTML(app.interviewTime || "")}">

                <button type="button" onclick="saveApplication('${id}')">Save Updates</button>
                <button type="button" onclick="openInterviewTemplate('${id}')">Invite to Interview</button>
                <button type="button" onclick="deleteApplication('${id}')">Delete Candidate</button>

                <div id="template-${id}" style="display:none;margin-top:25px;">
                    <h3>Interview Invitation Template</h3>

                    <textarea id="emailTemplate-${id}" style="min-height:270px;"></textarea>

                    <button type="button" onclick="copyInterviewTemplate('${id}')">Copy Template</button>
                    <button type="button" onclick="openEmailClient('${id}')">Open Email</button>
                    <button type="button" onclick="markInvitationSent('${id}')">Mark Invitation Sent</button>
                </div>
            </div>
        `;
    }).join("");
}

/* =====================================================
   SAVE APPLICATION
===================================================== */

async function saveApplication(id) {
    const token = getToken();

    const status = document.getElementById(`status-${id}`).value;
    const rating = Number(document.getElementById(`rating-${id}`).value);
    const notes = document.getElementById(`notes-${id}`).value;
    const interviewDate = document.getElementById(`interviewDate-${id}`).value;
    const interviewTime = document.getElementById(`interviewTime-${id}`).value;

    try {
        const result = await fetchJSON(`/api/admin/applications/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                status,
                rating,
                notes,
                interviewDate,
                interviewTime
            })
        });

        if (result.success) {
            showToast("Application updated successfully.", "success");
            await loadApplications();
        }

    } catch (error) {
        console.error("Save error:", error);
        showToast(error.message || "Failed to save application.", "error");
    }
}

/* =====================================================
   DELETE APPLICATION
===================================================== */

async function deleteApplication(id) {
    const confirmed = confirm("Are you sure you want to delete this candidate?");
    if (!confirmed) return;

    const token = getToken();

    try {
        const result = await fetchJSON(`/api/admin/applications/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (result.success) {
            showToast("Candidate deleted successfully.", "success");
            await loadApplications();
        }

    } catch (error) {
        console.error("Delete error:", error);
        showToast(error.message || "Failed to delete candidate.", "error");
    }
}

/* =====================================================
   INTERVIEW TEMPLATE
===================================================== */

function findApplication(id) {
    return allApplications.find(app => app.id === id);
}

function openInterviewTemplate(id) {
    const app = findApplication(id);

    if (!app) {
        showToast("Candidate not found.", "error");
        return;
    }

    const templateBox = document.getElementById(`template-${id}`);
    const templateArea = document.getElementById(`emailTemplate-${id}`);

    const interviewDate =
        document.getElementById(`interviewDate-${id}`).value ||
        "[INSERT INTERVIEW DATE]";

    const interviewTime =
        document.getElementById(`interviewTime-${id}`).value ||
        "[INSERT INTERVIEW TIME]";

    const template = `Subject: Invitation to Interview - ${app.position || "Your Application"}

Dear ${app.fullName || "Candidate"},

Thank you for applying for the role of ${app.position || "the advertised position"} with The Excellent Management Company.

We are pleased to invite you to attend an interview.

Interview details:

Date: ${interviewDate}
Time: ${interviewTime}
Location: [INSERT INTERVIEW LOCATION OR ONLINE MEETING LINK]

Please bring any relevant documents with you, including proof of identity and any certificates or qualifications that may support your application.

If you are unable to attend this interview time, please contact us as soon as possible so that we can discuss alternative arrangements.

We look forward to meeting you.

Kind regards,

The Excellent Management Company
Recruitment Team`;

    templateArea.value = template;
    templateBox.style.display = "block";
}

async function copyInterviewTemplate(id) {
    const templateArea = document.getElementById(`emailTemplate-${id}`);

    try {
        await navigator.clipboard.writeText(templateArea.value);
        showToast("Interview template copied.", "success");
    } catch (error) {
        console.error("Copy error:", error);
        showToast("Could not copy template.", "error");
    }
}

function openEmailClient(id) {
    const app = findApplication(id);
    const templateArea = document.getElementById(`emailTemplate-${id}`);

    if (!app || !app.email) {
        showToast("Candidate email not found.", "error");
        return;
    }

    const subject = encodeURIComponent(
        `Invitation to Interview - ${app.position || "Your Application"}`
    );

    const body = encodeURIComponent(templateArea.value);

    window.location.href = `mailto:${app.email}?subject=${subject}&body=${body}`;
}

async function markInvitationSent(id) {
    const token = getToken();

    const interviewDate = document.getElementById(`interviewDate-${id}`).value;
    const interviewTime = document.getElementById(`interviewTime-${id}`).value;

    try {
        const result = await fetchJSON(`/api/admin/applications/${id}/invite`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                interviewDate,
                interviewTime
            })
        });

        if (result.success) {
            showToast("Invitation marked as sent.", "success");
            await loadApplications();
        }

    } catch (error) {
        console.error("Invitation error:", error);
        showToast(error.message || "Failed to mark invitation sent.", "error");
    }
}

/* =====================================================
   EXPORT CSV
===================================================== */

if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", exportCSV);
}

function exportCSV() {
    if (!allApplications.length) {
        showToast("No applications to export.", "info");
        return;
    }

    const headers = [
        "Full Name",
        "Email",
        "Phone",
        "Position",
        "Status",
        "Rating",
        "Notes",
        "Interview Date",
        "Interview Time",
        "CV URL"
    ];

    const rows = allApplications.map(app => [
        app.fullName || "",
        app.email || "",
        app.phone || "",
        app.position || "",
        app.status || "",
        app.rating || "",
        app.notes || "",
        app.interviewDate || "",
        app.interviewTime || "",
        app.cvUrl || ""
    ]);

    const csvContent = [headers, ...rows]
        .map(row =>
            row.map(value =>
                `"${String(value).replaceAll('"', '""')}"`
            ).join(",")
        )
        .join("\n");

    const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "temc-applications.csv";
    link.click();

    URL.revokeObjectURL(link.href);
}

/* =====================================================
   AUTO START
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
    const token = getToken();

    if (token) {
        loginBox.style.display = "none";
        dashboardContent.style.display = "block";

        await loadApplications();
    } else {
        loginBox.style.display = "block";
        dashboardContent.style.display = "none";
    }
});
