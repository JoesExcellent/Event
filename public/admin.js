/* TEMC Recruitment Dashboard - Firebase-ready admin.js */

const statsContainer = document.getElementById("stats");
const loginBox = document.getElementById("loginBox");
const dashboardContent = document.getElementById("dashboardContent");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const loginMessage = document.getElementById("loginMessage");
const applicationsContainer = document.getElementById("applications");
const adminInfo = document.getElementById("adminInfo");

let allApplications = [];
let currentApplications = [];
let visibleCount = 5;
const pageSize = 5;

function escapeHTML(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getToken() {
    return localStorage.getItem("adminToken") || "";
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
    };
}

function showToast(message, type = "success") {
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

    setTimeout(() => toast.remove(), 3500);
}

function showAdminInfo(admin) {
    if (!adminInfo) return;
    adminInfo.innerHTML = `
        <div class="application-card">
            <h2>Logged in as ${escapeHTML(admin.name || "Admin")}</h2>
            <p><strong>Email:</strong> ${escapeHTML(admin.email || "")}</p>
            <p><strong>Role:</strong> ${escapeHTML(admin.role || "admin")}</p>
        </div>
    `;
}

async function loginAdmin() {
    const emailInput = document.getElementById("adminEmail");
    const passwordInput = document.getElementById("adminPassword");
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!email || !password) {
        if (loginMessage) loginMessage.textContent = "Please enter email and password.";
        return;
    }

    try {
        if (loginMessage) loginMessage.textContent = "Logging in...";

        const response = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            if (loginMessage) loginMessage.textContent = result.message || "Invalid login details.";
            return;
        }

        localStorage.setItem("adminToken", result.token);
        localStorage.setItem("adminUser", JSON.stringify(result.admin));

        if (loginBox) loginBox.style.display = "none";
        if (dashboardContent) dashboardContent.style.display = "block";
        if (loginMessage) loginMessage.textContent = "";

        showAdminInfo(result.admin);
        await loadApplications();
    } catch (error) {
        console.error("Login error:", error);
        if (loginMessage) loginMessage.textContent = "Server error. Make sure the backend is running.";
    }
}

function logoutAdmin() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    location.reload();
}

async function loadApplications() {
    try {
        const response = await fetch("/api/applications", { headers: authHeaders() });
        const data = await response.json();

        if (response.status === 401) {
            logoutAdmin();
            return;
        }

        if (!applicationsContainer) return;
        applicationsContainer.innerHTML = "";

        if (!response.ok || !data.success) {
            applicationsContainer.innerHTML = `<div class="application-card"><h2>Error loading applications</h2><p>${escapeHTML(data.message || "Please check the server.")}</p></div>`;
            return;
        }

        allApplications = Array.isArray(data.applications) ? data.applications : [];
        currentApplications = allApplications;
        visibleCount = pageSize;

        renderStats(allApplications);
        renderAnalytics(allApplications);
        renderInterviewCalendar(allApplications);
        renderFilters();
        renderApplications(currentApplications);
    } catch (error) {
        console.error("Load applications error:", error);
        if (applicationsContainer) {
            applicationsContainer.innerHTML = `<div class="application-card"><h2>Error loading applications</h2><p>Please check the server is running.</p></div>`;
        }
    }
}

function removeSection(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function renderStats(applications) {
    if (!statsContainer) return;
    const count = status => applications.filter(app => (app.status || "New") === status).length;
    const favouriteCount = applications.filter(app => app.favourite === true).length;

    statsContainer.innerHTML = `
        <div class="stats-grid">
            <div class="application-card"><h2>${applications.length}</h2><p>Total Applications</p></div>
            <div class="application-card"><h2>${count("New")}</h2><p>New</p></div>
            <div class="application-card"><h2>${count("Reviewed")}</h2><p>Reviewed</p></div>
            <div class="application-card"><h2>${count("Interview")}</h2><p>Interview</p></div>
            <div class="application-card"><h2>${count("Rejected")}</h2><p>Rejected</p></div>
            <div class="application-card"><h2>${favouriteCount}</h2><p>Shortlisted</p></div>
        </div>
    `;
}

function renderAnalytics(applications) {
    removeSection("analyticsDashboard");
    if (!applicationsContainer) return;

    const total = applications.length || 1;
    const statuses = ["New", "Reviewed", "Interview", "Rejected"];
    const averageRating = applications.length
        ? (applications.reduce((sum, app) => sum + Number(app.rating || 0), 0) / applications.length).toFixed(1)
        : "0.0";

    const box = document.createElement("div");
    box.id = "analyticsDashboard";
    box.className = "application-card";
    box.innerHTML = `
        <h2>Charts & Graph Dashboard</h2>
        ${statuses.map(status => {
            const count = applications.filter(app => (app.status || "New") === status).length;
            const width = Math.round((count / total) * 100);
            return `<p>${status} — ${count}</p><div class="analytics-bar"><div class="analytics-fill" style="width:${width}%"></div></div>`;
        }).join("")}
        <p><strong>Average Rating:</strong> ${averageRating} / 5</p>
    `;
    applicationsContainer.before(box);
}

function renderInterviewCalendar(applications) {
    removeSection("interviewCalendar");
    if (!applicationsContainer) return;

    const interviews = applications
        .filter(app => app.interviewDate && app.interviewTime)
        .sort((a, b) => `${a.interviewDate} ${a.interviewTime}`.localeCompare(`${b.interviewDate} ${b.interviewTime}`));

    const box = document.createElement("div");
    box.id = "interviewCalendar";
    box.className = "application-card";
    box.innerHTML = `
        <h2>Interview Calendar</h2>
        ${interviews.length ? interviews.map(app => `
            <div class="sub-card">
                <h3>${escapeHTML(app.fullName || "Candidate")}</h3>
                <p><strong>Date:</strong> ${escapeHTML(app.interviewDate)}</p>
                <p><strong>Time:</strong> ${escapeHTML(app.interviewTime)}</p>
                <p><strong>Location / Link:</strong> ${escapeHTML(app.interviewLocation || "Not added")}</p>
            </div>
        `).join("") : "<p>No interviews scheduled yet.</p>"}
    `;
    applicationsContainer.before(box);
}

function renderFilters() {
    removeSection("filterBox");
    if (!applicationsContainer) return;

    const box = document.createElement("div");
    box.id = "filterBox";
    box.className = "application-card";
    box.innerHTML = `
        <h2>Search & Filter Candidates</h2>
        <input type="text" id="candidateSearch" placeholder="Search by name, email, or position">
        <select id="statusFilter">
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Interview">Interview</option>
            <option value="Rejected">Rejected</option>
        </select>
        <select id="ratingFilter">
            <option value="">All Ratings</option>
            <option value="0">No Rating</option>
            <option value="1">★</option>
            <option value="2">★★</option>
            <option value="3">★★★</option>
            <option value="4">★★★★</option>
            <option value="5">★★★★★</option>
        </select>
        <select id="favouriteFilter">
            <option value="">All Candidates</option>
            <option value="true">Shortlisted Only</option>
            <option value="false">Not Shortlisted</option>
        </select>
        <button id="clearFiltersBtn" type="button">Clear Filters</button>
    `;

    applicationsContainer.before(box);
    document.getElementById("candidateSearch").addEventListener("input", applyFilters);
    document.getElementById("statusFilter").addEventListener("change", applyFilters);
    document.getElementById("ratingFilter").addEventListener("change", applyFilters);
    document.getElementById("favouriteFilter").addEventListener("change", applyFilters);
    document.getElementById("clearFiltersBtn").addEventListener("click", () => {
        ["candidateSearch", "statusFilter", "ratingFilter", "favouriteFilter"].forEach(id => document.getElementById(id).value = "");
        currentApplications = allApplications;
        visibleCount = pageSize;
        renderApplications(currentApplications);
    });
}

function applyFilters() {
    const searchText = (document.getElementById("candidateSearch").value || "").toLowerCase();
    const statusValue = document.getElementById("statusFilter").value;
    const ratingValue = document.getElementById("ratingFilter").value;
    const favouriteValue = document.getElementById("favouriteFilter").value;

    currentApplications = allApplications.filter(app => {
        const combined = `${app.fullName || ""} ${app.email || ""} ${app.position || ""}`.toLowerCase();
        return combined.includes(searchText)
            && (!statusValue || (app.status || "New") === statusValue)
            && (ratingValue === "" || Number(app.rating || 0) === Number(ratingValue))
            && (favouriteValue === "" || String(Boolean(app.favourite)) === favouriteValue);
    });

    visibleCount = pageSize;
    renderApplications(currentApplications);
}

function cvUrl(app) {
    return app.cvUrl || (app.cvFile ? `/uploads/${encodeURIComponent(app.cvFile)}` : "");
}


function formatInterviewDate(dateValue) {
    if (!dateValue) return "[add interview date]";
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateValue;
    return date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function formatInterviewTime(timeValue) {
    if (!timeValue) return "[add interview time]";
    return timeValue;
}

function buildInterviewInvitation(app) {
    const name = app.fullName || "Candidate";
    const position = app.position || "the role you applied for";
    const interviewDate = formatInterviewDate(app.interviewDate);
    const interviewTime = formatInterviewTime(app.interviewTime);
    const interviewLocation = app.interviewLocation || "[add interview location / Google Meet / Teams link]";

    return `Dear ${name},

Thank you for your application for the position of ${position} with The Excellent Management Company.

We are pleased to invite you to attend an interview.

Interview details:
Date: ${interviewDate}
Time: ${interviewTime}
Location / Link: ${interviewLocation}

Please reply to confirm whether you are able to attend. If you need any reasonable adjustments for the interview, please let us know in advance and we will do our best to support you.

Please also bring or have available any documents that may support your application, including proof of identity and any relevant certificates or qualifications.

We look forward to speaking with you.

Kind regards,
The Excellent Management Company
Recruitment Team`;
}

function ensureInvitationModal() {
    let modal = document.getElementById("invitationModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "invitationModal";
    modal.className = "modal-backdrop";
    modal.style.display = "none";
    modal.innerHTML = `
        <div class="modal-card invitation-modal-card">
            <button id="closeInvitationModal" class="modal-close" type="button">×</button>
            <h2>Invite to Interview Template</h2>
            <p id="invitationCandidateLine" class="modal-subtitle"></p>
            <label>Email Subject</label>
            <input id="invitationSubject" type="text" value="Interview Invitation - The Excellent Management Company">
            <label>Email Message</label>
            <textarea id="invitationMessage" class="invitation-textarea"></textarea>
            <div class="button-row">
                <button id="copyInvitationBtn" type="button">Copy Template</button>
                <button id="emailCandidateBtn" type="button">Open Email</button>
                <button id="markInvitationSentBtn" type="button">Mark Invitation Sent</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector("#closeInvitationModal").addEventListener("click", () => {
        modal.style.display = "none";
    });

    modal.addEventListener("click", event => {
        if (event.target === modal) modal.style.display = "none";
    });

    return modal;
}

function openInvitationTemplate(app) {
    const modal = ensureInvitationModal();
    const subjectInput = modal.querySelector("#invitationSubject");
    const messageBox = modal.querySelector("#invitationMessage");
    const candidateLine = modal.querySelector("#invitationCandidateLine");
    const copyBtn = modal.querySelector("#copyInvitationBtn");
    const emailBtn = modal.querySelector("#emailCandidateBtn");
    const markBtn = modal.querySelector("#markInvitationSentBtn");

    const subject = `Interview Invitation - ${app.position || "Application"}`;
    const message = buildInterviewInvitation(app);

    subjectInput.value = subject;
    messageBox.value = message;
    candidateLine.textContent = `${app.fullName || "Candidate"} • ${app.email || "No email"}`;

    copyBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(`${subject}\n\n${messageBox.value}`);
            showToast("Interview invitation template copied");
        } catch (error) {
            messageBox.select();
            document.execCommand("copy");
            showToast("Interview invitation template copied");
        }
    };

    emailBtn.onclick = () => {
        const mailto = `mailto:${encodeURIComponent(app.email || "")}?subject=${encodeURIComponent(subjectInput.value)}&body=${encodeURIComponent(messageBox.value)}`;
        window.location.href = mailto;
    };

    markBtn.onclick = async () => {
        try {
            const response = await fetch(`/api/applications/${encodeURIComponent(app.id)}/send-invitation`, {
                method: "POST",
                headers: authHeaders()
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || "Failed to mark invitation sent");
            showToast("Invitation marked as sent");
            modal.style.display = "none";
            await loadApplications();
        } catch (error) {
            showToast(error.message, "error");
        }
    };

    modal.style.display = "flex";
}

function renderApplications(applications) {
    if (!applicationsContainer) return;
    removeSection("loadMoreBox");
    applicationsContainer.innerHTML = "";

    if (!applications.length) {
        applicationsContainer.innerHTML = `<div class="application-card"><h2>No candidates found</h2><p>Submitted applications will appear here.</p></div>`;
        return;
    }

    applications.slice(0, visibleCount).forEach(app => {
        const url = cvUrl(app);
        const card = document.createElement("div");
        card.className = "application-card candidate-card";
        card.innerHTML = `
            <h2>${app.favourite ? "⭐ " : ""}${escapeHTML(app.fullName || "No name")}</h2>
            <p><strong>Email:</strong> ${escapeHTML(app.email || "")}</p>
            <p><strong>Phone:</strong> ${escapeHTML(app.phone || "")}</p>
            <p><strong>Position:</strong> ${escapeHTML(app.position || "")}</p>
            <p><strong>About:</strong> ${escapeHTML(app.about || "")}</p>
            <p><strong>Submitted:</strong> ${escapeHTML(app.createdAt || "")}</p>

            <div class="button-row">
                <button class="view-profile-btn" data-id="${escapeHTML(app.id)}" type="button">View Profile</button>
                <button class="favourite-btn" data-id="${escapeHTML(app.id)}" data-favourite="${app.favourite ? "true" : "false"}" type="button">${app.favourite ? "Remove Shortlist" : "Shortlist"}</button>
                ${url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener"><button type="button">Open CV</button></a>` : ""}
            </div>

            <label>Status</label>
            <select class="status-dropdown" data-id="${escapeHTML(app.id)}">
                <option value="New" ${(app.status || "New") === "New" ? "selected" : ""}>New</option>
                <option value="Reviewed" ${app.status === "Reviewed" ? "selected" : ""}>Reviewed</option>
                <option value="Interview" ${app.status === "Interview" ? "selected" : ""}>Interview</option>
                <option value="Rejected" ${app.status === "Rejected" ? "selected" : ""}>Rejected</option>
            </select>

            <label>Rating</label>
            <select class="rating-dropdown" data-id="${escapeHTML(app.id)}">
                ${[0, 1, 2, 3, 4, 5].map(num => `<option value="${num}" ${Number(app.rating || 0) === num ? "selected" : ""}>${num === 0 ? "No Rating" : "★".repeat(num)}</option>`).join("")}
            </select>

            <label>Admin Notes</label>
            <textarea class="notes-box" data-id="${escapeHTML(app.id)}">${escapeHTML(app.notes || "")}</textarea>
            <button class="save-notes-btn" data-id="${escapeHTML(app.id)}" type="button">Save Notes</button>

            <div class="interview-grid">
                <input class="interview-date" data-id="${escapeHTML(app.id)}" type="date" value="${escapeHTML(app.interviewDate || "")}">
                <input class="interview-time" data-id="${escapeHTML(app.id)}" type="time" value="${escapeHTML(app.interviewTime || "")}">
                <input class="interview-location" data-id="${escapeHTML(app.id)}" type="text" placeholder="Interview location or link" value="${escapeHTML(app.interviewLocation || "")}">
            </div>
            <div class="button-row">
                <button class="save-interview-btn" data-id="${escapeHTML(app.id)}" type="button">Save Interview</button>
                <button class="open-invitation-btn" data-id="${escapeHTML(app.id)}" type="button">Invite to Interview</button>
                <button class="send-invitation-btn" data-id="${escapeHTML(app.id)}" type="button">Mark Invitation Sent</button>
                <button class="delete-candidate-btn danger" data-id="${escapeHTML(app.id)}" data-name="${escapeHTML(app.fullName || "candidate")}" type="button">Delete</button>
            </div>
        `;
        applicationsContainer.appendChild(card);
    });

    addCardListeners();
    renderLoadMore(applications);
}

function renderLoadMore(applications) {
    removeSection("loadMoreBox");
    if (visibleCount >= applications.length || !applicationsContainer) return;

    const box = document.createElement("div");
    box.id = "loadMoreBox";
    box.className = "application-card";
    box.innerHTML = `<p>Showing ${visibleCount} of ${applications.length} candidates</p><button id="loadMoreBtn" type="button">Load More</button>`;
    applicationsContainer.appendChild(box);
    document.getElementById("loadMoreBtn").addEventListener("click", () => {
        visibleCount += pageSize;
        renderApplications(currentApplications);
    });
}

function openCandidateProfile(app) {
    const existingModal = document.getElementById("candidateProfileModal");
    if (existingModal) existingModal.remove();

    const url = cvUrl(app);
    const modal = document.createElement("div");
    modal.id = "candidateProfileModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h2>${app.favourite ? "⭐ " : ""}${escapeHTML(app.fullName || "No name")}</h2>
                <button id="closeCandidateProfileBtn" class="danger" type="button">Close</button>
            </div>
            <div class="profile-grid">
                <div class="application-card"><h3>Candidate Details</h3><p><strong>Email:</strong> ${escapeHTML(app.email || "")}</p><p><strong>Phone:</strong> ${escapeHTML(app.phone || "")}</p><p><strong>Position:</strong> ${escapeHTML(app.position || "")}</p><p><strong>Status:</strong> ${escapeHTML(app.status || "New")}</p><p><strong>Rating:</strong> ${"★".repeat(Number(app.rating || 0)) || "No Rating"}</p></div>
                <div class="application-card"><h3>Interview Details</h3><p><strong>Date:</strong> ${escapeHTML(app.interviewDate || "Not set")}</p><p><strong>Time:</strong> ${escapeHTML(app.interviewTime || "Not set")}</p><p><strong>Location:</strong> ${escapeHTML(app.interviewLocation || "Not set")}</p><p><strong>Invitation Sent:</strong> ${app.invitationSent ? "Yes" : "No"}</p></div>
            </div>
            <div class="application-card"><h3>About</h3><p>${escapeHTML(app.about || "No information added.")}</p></div>
            <div class="application-card"><h3>Admin Notes</h3><p>${escapeHTML(app.notes || "No notes added.")}</p></div>
            <div class="application-card"><h3>CV</h3>${url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener"><button type="button">Open / Download CV</button></a>` : "<p>No CV uploaded.</p>"}</div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("closeCandidateProfileBtn").addEventListener("click", () => modal.remove());
}

async function patchJson(url, body) {
    const response = await fetch(url, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Request failed");
    return result;
}

function addCardListeners() {
    document.querySelectorAll(".view-profile-btn").forEach(button => {
        button.addEventListener("click", event => {
            const app = allApplications.find(item => item.id === event.currentTarget.dataset.id);
            if (app) openCandidateProfile(app);
        });
    });

    document.querySelectorAll(".favourite-btn").forEach(button => {
        button.addEventListener("click", async event => {
            try {
                const id = event.currentTarget.dataset.id;
                const favourite = event.currentTarget.dataset.favourite !== "true";
                await patchJson(`/api/applications/${encodeURIComponent(id)}/favourite`, { favourite });
                showToast(favourite ? "Candidate shortlisted" : "Candidate removed from shortlist");
                await loadApplications();
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    });

    document.querySelectorAll(".status-dropdown").forEach(select => {
        select.addEventListener("change", async event => {
            try {
                await patchJson(`/api/applications/${encodeURIComponent(event.currentTarget.dataset.id)}/status`, { status: event.currentTarget.value });
                showToast("Status updated");
                await loadApplications();
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    });

    document.querySelectorAll(".rating-dropdown").forEach(select => {
        select.addEventListener("change", async event => {
            try {
                await patchJson(`/api/applications/${encodeURIComponent(event.currentTarget.dataset.id)}/rating`, { rating: Number(event.currentTarget.value) });
                showToast("Rating updated");
                await loadApplications();
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    });

    document.querySelectorAll(".save-notes-btn").forEach(button => {
        button.addEventListener("click", async event => {
            try {
                const id = event.currentTarget.dataset.id;
                const textarea = document.querySelector(`.notes-box[data-id="${CSS.escape(id)}"]`);
                await patchJson(`/api/applications/${encodeURIComponent(id)}/notes`, { notes: textarea ? textarea.value : "" });
                showToast("Notes saved");
                await loadApplications();
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    });

    document.querySelectorAll(".save-interview-btn").forEach(button => {
        button.addEventListener("click", async event => {
            try {
                const id = event.currentTarget.dataset.id;
                await patchJson(`/api/applications/${encodeURIComponent(id)}/interview`, {
                    interviewDate: document.querySelector(`.interview-date[data-id="${CSS.escape(id)}"]`)?.value || "",
                    interviewTime: document.querySelector(`.interview-time[data-id="${CSS.escape(id)}"]`)?.value || "",
                    interviewLocation: document.querySelector(`.interview-location[data-id="${CSS.escape(id)}"]`)?.value || ""
                });
                showToast("Interview details saved");
                await loadApplications();
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    });


    document.querySelectorAll(".open-invitation-btn").forEach(button => {
        button.addEventListener("click", event => {
            const id = event.currentTarget.dataset.id;
            const app = allApplications.find(item => String(item.id) === String(id));
            if (!app) {
                showToast("Candidate not found", "error");
                return;
            }
            openInvitationTemplate(app);
        });
    });

    document.querySelectorAll(".send-invitation-btn").forEach(button => {
        button.addEventListener("click", async event => {
            if (!confirm("Mark this candidate's interview invitation as sent?")) return;
            try {
                const response = await fetch(`/api/applications/${encodeURIComponent(event.currentTarget.dataset.id)}/send-invitation`, {
                    method: "POST",
                    headers: authHeaders()
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.message || "Failed to mark invitation sent");
                showToast("Invitation marked as sent");
                await loadApplications();
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    });

    document.querySelectorAll(".delete-candidate-btn").forEach(button => {
        button.addEventListener("click", async event => {
            const name = event.currentTarget.dataset.name || "this candidate";
            if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
            try {
                const response = await fetch(`/api/applications/${encodeURIComponent(event.currentTarget.dataset.id)}`, {
                    method: "DELETE",
                    headers: authHeaders()
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.message || "Failed to delete candidate");
                showToast("Candidate deleted");
                await loadApplications();
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    });
}

function exportCSV() {
    const rows = [["Name", "Email", "Phone", "Position", "Status", "Rating", "Shortlisted", "Interview Date", "Interview Time", "CV URL"]];
    currentApplications.forEach(app => {
        rows.push([
            app.fullName || "", app.email || "", app.phone || "", app.position || "", app.status || "New", app.rating || 0,
            app.favourite ? "Yes" : "No", app.interviewDate || "", app.interviewTime || "", cvUrl(app)
        ]);
    });

    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "temc-applications.csv";
    link.click();
    URL.revokeObjectURL(url);
}

function restoreSavedLogin() {
    const token = getToken();
    const adminUserRaw = localStorage.getItem("adminUser");

    if (!token || !adminUserRaw) {
        if (loginBox) loginBox.style.display = "block";
        if (dashboardContent) dashboardContent.style.display = "none";
        return;
    }

    try {
        const admin = JSON.parse(adminUserRaw);
        if (loginBox) loginBox.style.display = "none";
        if (dashboardContent) dashboardContent.style.display = "block";
        showAdminInfo(admin);
        loadApplications();
    } catch (error) {
        logoutAdmin();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (loginBtn) loginBtn.addEventListener("click", loginAdmin);
    if (logoutBtn) logoutBtn.addEventListener("click", logoutAdmin);
    if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCSV);

    const adminPasswordInput = document.getElementById("adminPassword");
    if (adminPasswordInput) {
        adminPasswordInput.addEventListener("keydown", event => {
            if (event.key === "Enter") loginAdmin();
        });
    }

    restoreSavedLogin();
});
