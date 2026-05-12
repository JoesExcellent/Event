
/* =====================================================
   TEMC ADMIN DASHBOARD - FULL WORKING ADMIN.JS
   Login fixed for:
   Email: joseph.eldridge1964@gmail.com
   Password: temc2026
===================================================== */

const ADMIN_EMAIL = "joseph.eldridge1964@gmail.com";
const ADMIN_PASSWORD = "temc2026";

let allApplications = [];
let currentApplications = [];

document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const logoutBtn = document.getElementById("logoutBtn");
    const exportCsvBtn = document.getElementById("exportCsvBtn");
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const ratingFilter = document.getElementById("ratingFilter");
    const positionFilter = document.getElementById("positionFilter");
    const clearFiltersBtn = document.getElementById("clearFiltersBtn");

    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", exportCSV);
    }

    if (searchInput) {
        searchInput.addEventListener("input", applyFilters);
    }

    if (statusFilter) {
        statusFilter.addEventListener("change", applyFilters);
    }

    if (ratingFilter) {
        ratingFilter.addEventListener("change", applyFilters);
    }

    if (positionFilter) {
        positionFilter.addEventListener("change", applyFilters);
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener("click", clearFilters);
    }

    if (localStorage.getItem("temcAdminLoggedIn") === "true") {
        showAdminDashboard();
    }
});

function handleLogin(event) {
    event.preventDefault();

    const emailInput = document.getElementById("adminEmail");
    const passwordInput = document.getElementById("adminPassword");
    const message = document.getElementById("loginMessage");

    const enteredEmail = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const enteredPassword = passwordInput ? passwordInput.value.trim() : "";

    if (enteredEmail === ADMIN_EMAIL.toLowerCase() && enteredPassword === ADMIN_PASSWORD) {
        localStorage.setItem("temcAdminLoggedIn", "true");
        if (message) message.textContent = "";
        showAdminDashboard();
        return;
    }

    if (message) {
        message.textContent = "Incorrect email or password.";
        message.style.color = "#ffcc00";
        message.style.marginTop = "15px";
        message.style.fontWeight = "bold";
    }
}

function showAdminDashboard() {
    const loginSection = document.getElementById("loginSection");
    const adminArea = document.getElementById("adminArea");

    if (loginSection) {
        loginSection.classList.add("hidden");
    }

    if (adminArea) {
        adminArea.classList.remove("hidden");
    }

    loadApplications();
}

function handleLogout() {
    localStorage.removeItem("temcAdminLoggedIn");

    const loginSection = document.getElementById("loginSection");
    const adminArea = document.getElementById("adminArea");

    if (adminArea) {
        adminArea.classList.add("hidden");
    }

    if (loginSection) {
        loginSection.classList.remove("hidden");
    }
}

async function loadApplications() {
    try {
        const response = await fetch("/admin/applications");

        if (!response.ok) {
            throw new Error("Applications endpoint unavailable.");
        }

        const data = await response.json();

        if (Array.isArray(data)) {
            allApplications = data;
        } else if (Array.isArray(data.applications)) {
            allApplications = data.applications;
        } else {
            allApplications = [];
        }

    } catch (error) {
        allApplications = getLocalDemoApplications();
    }

    currentApplications = [...allApplications];

    populatePositionFilter();
    renderStats();
    renderApplications();
    renderChartSafely();
}

function renderStats() {
    setText("totalApplications", allApplications.length);
    setText("newApplications", countByStatus("New"));
    setText("reviewedApplications", countByStatus("Reviewed"));
    setText("interviewApplications", countByStatus("To Be Interviewed") + countByStatus("Interview Stage"));
    setText("rejectedApplications", countByStatus("Rejected"));
    setText("hiredApplications", countByStatus("Hired"));
}

function countByStatus(statusName) {
    return allApplications.filter(function (app) {
        return String(app.status || "").toLowerCase() === String(statusName).toLowerCase();
    }).length;
}

function renderApplications() {
    const list = document.getElementById("applicationsList");
    const showingCount = document.getElementById("showingCount");

    if (!list) return;

    list.innerHTML = "";

    if (showingCount) {
        showingCount.textContent = `Showing ${currentApplications.length} of ${allApplications.length} applications`;
    }

    if (!currentApplications.length) {
        list.innerHTML = "<p>No applications found.</p>";
        return;
    }

    currentApplications.forEach(function (app) {
        const id = app.id || app.applicationId || app._id || "";
        const name = app.name || app.fullName || "Unnamed Candidate";
        const email = app.email || "No email supplied";
        const phone = app.phone || "No phone supplied";
        const position = app.position || app.role || "No position supplied";
        const about = app.about || app.message || "No summary supplied.";
        const status = app.status || "New";
        const rating = app.rating || "0";
        const applied = app.applied || app.createdAt || app.date || "No date supplied";
        const cvUrl = app.cvUrl || app.cv || app.fileUrl || "";

        const card = document.createElement("article");
        card.className = "candidate-card application-card";

        card.innerHTML = `
            <h3>${escapeHTML(name)}</h3>

            <div class="candidate-photo-placeholder">
                Candidate Photograph Placeholder
            </div>

            <div class="candidate-notes-box">
                Add recruiter observations, candidate summary notes, assessment information and interview highlights here.
            </div>

            <p><strong>Email:</strong> ${escapeHTML(email)}</p>
            <p><strong>Phone:</strong> ${escapeHTML(phone)}</p>
            <p><strong>Position:</strong> ${escapeHTML(position)}</p>
            <p><strong>About:</strong> ${escapeHTML(about)}</p>
            <p><strong>Status:</strong> ${escapeHTML(status)}</p>
            <p><strong>Rating:</strong> ${escapeHTML(rating)} / 5</p>
            <p><strong>Applied:</strong> ${escapeHTML(formatDate(applied))}</p>

            ${cvUrl ? `<p><a href="${escapeAttribute(cvUrl)}" target="_blank">View CV</a></p>` : ""}

            <label>Status</label>
            <select id="status-${escapeAttribute(id)}">
                ${statusOption("New", status)}
                ${statusOption("Reviewed", status)}
                ${statusOption("To Be Interviewed", status)}
                ${statusOption("Interview Stage", status)}
                ${statusOption("Rejected", status)}
                ${statusOption("Hired", status)}
            </select>

            <label>Rating</label>
            <select id="rating-${escapeAttribute(id)}">
                ${ratingOption("0", rating)}
                ${ratingOption("1", rating)}
                ${ratingOption("2", rating)}
                ${ratingOption("3", rating)}
                ${ratingOption("4", rating)}
                ${ratingOption("5", rating)}
            </select>

            <label>Notes</label>
            <textarea id="notes-${escapeAttribute(id)}">${escapeHTML(app.notes || "")}</textarea>

            <label>Interview Date</label>
            <input type="date" id="interviewDate-${escapeAttribute(id)}" value="${escapeAttribute(app.interviewDate || "")}">

            <label>Interview Time</label>
            <input type="time" id="interviewTime-${escapeAttribute(id)}" value="${escapeAttribute(app.interviewTime || "")}">

            <div class="candidate-actions">
                <button type="button" onclick="saveCandidate('${escapeAttribute(id)}')">Save Updates</button>
                <button type="button" onclick="rejectCandidate('${escapeAttribute(id)}')">Reject Candidate</button>
                <button type="button" onclick="inviteCandidate('${escapeAttribute(id)}')">Invite to Interview</button>
                <button type="button" onclick="deleteCandidate('${escapeAttribute(id)}')">Delete Candidate</button>
            </div>
        `;

        list.appendChild(card);
    });
}

function saveCandidate(id) {
    const app = findApplication(id);
    if (!app) return;

    const statusField = document.getElementById(`status-${id}`);
    const ratingField = document.getElementById(`rating-${id}`);
    const notesField = document.getElementById(`notes-${id}`);
    const dateField = document.getElementById(`interviewDate-${id}`);
    const timeField = document.getElementById(`interviewTime-${id}`);

    app.status = statusField ? statusField.value : app.status;
    app.rating = ratingField ? ratingField.value : app.rating;
    app.notes = notesField ? notesField.value : app.notes;
    app.interviewDate = dateField ? dateField.value : app.interviewDate;
    app.interviewTime = timeField ? timeField.value : app.interviewTime;

    refreshDashboard();
    alert("Candidate updates saved successfully.");
}

function rejectCandidate(id) {
    const app = findApplication(id);
    if (!app) return;

    app.status = "Rejected";
    refreshDashboard();
}

function inviteCandidate(id) {
    const app = findApplication(id);
    if (!app) return;

    app.status = "To Be Interviewed";
    refreshDashboard();
}

function deleteCandidate(id) {
    const confirmed = confirm("Are you sure you want to delete this candidate?");
    if (!confirmed) return;

    allApplications = allApplications.filter(function (app) {
        return String(app.id || app.applicationId || app._id || "") !== String(id);
    });

    refreshDashboard();
}

function refreshDashboard() {
    applyFilters();
    renderStats();
    renderChartSafely();
}

function applyFilters() {
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const ratingFilter = document.getElementById("ratingFilter");
    const positionFilter = document.getElementById("positionFilter");

    const search = searchInput ? searchInput.value.toLowerCase() : "";
    const status = statusFilter ? statusFilter.value : "all";
    const rating = ratingFilter ? ratingFilter.value : "all";
    const position = positionFilter ? positionFilter.value : "all";

    currentApplications = allApplications.filter(function (app) {
        const name = String(app.name || app.fullName || "").toLowerCase();
        const email = String(app.email || "").toLowerCase();
        const phone = String(app.phone || "").toLowerCase();
        const appPosition = String(app.position || app.role || "").toLowerCase();
        const appStatus = String(app.status || "New");
        const appRating = String(app.rating || "0");

        const matchesSearch =
            name.includes(search) ||
            email.includes(search) ||
            phone.includes(search) ||
            appPosition.includes(search);

        const matchesStatus = status === "all" || appStatus === status;
        const matchesRating = rating === "all" || appRating === rating;
        const matchesPosition = position === "all" || appPosition === position.toLowerCase();

        return matchesSearch && matchesStatus && matchesRating && matchesPosition;
    });

    renderApplications();
}

function clearFilters() {
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const ratingFilter = document.getElementById("ratingFilter");
    const positionFilter = document.getElementById("positionFilter");

    if (searchInput) searchInput.value = "";
    if (statusFilter) statusFilter.value = "all";
    if (ratingFilter) ratingFilter.value = "all";
    if (positionFilter) positionFilter.value = "all";

    currentApplications = [...allApplications];
    renderApplications();
}

function populatePositionFilter() {
    const positionFilter = document.getElementById("positionFilter");
    if (!positionFilter) return;

    const positions = [...new Set(allApplications.map(function (app) {
        return app.position || app.role || "";
    }).filter(Boolean))];

    positionFilter.innerHTML = '<option value="all">All Positions</option>';

    positions.forEach(function (position) {
        const option = document.createElement("option");
        option.value = position;
        option.textContent = position;
        positionFilter.appendChild(option);
    });
}

function exportCSV() {
    const rows = [
        ["Name", "Email", "Phone", "Position", "Status", "Rating", "Applied"]
    ];

    currentApplications.forEach(function (app) {
        rows.push([
            app.name || app.fullName || "",
            app.email || "",
            app.phone || "",
            app.position || app.role || "",
            app.status || "",
            app.rating || "",
            app.applied || app.createdAt || app.date || ""
        ]);
    });

    const csv = rows.map(function (row) {
        return row.map(function (cell) {
            return `"${String(cell).replace(/"/g, '""')}"`;
        }).join(",");
    }).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "temc-applications.csv";
    link.click();
}

function renderChartSafely() {
    if (typeof renderRecruitmentChart === "function") {
        renderRecruitmentChart(allApplications);
    }
}

function findApplication(id) {
    return allApplications.find(function (app) {
        return String(app.id || app.applicationId || app._id || "") === String(id);
    });
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function statusOption(value, selected) {
    return `<option value="${escapeAttribute(value)}" ${value === selected ? "selected" : ""}>${escapeHTML(value)}</option>`;
}

function ratingOption(value, selected) {
    return `<option value="${escapeAttribute(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHTML(value)}</option>`;
}

function formatDate(value) {
    if (!value) return "No date supplied";

    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
    return String(value)
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getLocalDemoApplications() {
    const saved = localStorage.getItem("temcApplications");

    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (error) {
            localStorage.removeItem("temcApplications");
        }
    }

    const demo = [
        {
            id: "1",
            name: "peter run peter run",
            email: "joseph@novacastrian-mundi.co.uk",
            phone: "+447845546844",
            position: "Courier cunt",
            about: "Dear Joseph Eldridge, We are pleased to invite you to interview for the Courier position.",
            status: "To Be Interviewed",
            rating: "0",
            applied: "2026-05-12T12:40:00",
            interviewDate: "",
            interviewTime: ""
        }
    ];

    localStorage.setItem("temcApplications", JSON.stringify(demo));
    return demo;
}
