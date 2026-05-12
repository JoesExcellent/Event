const API_BASE_URL = "";

let allApplications = [];
let currentApplications = [];

document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const logoutBtn = document.getElementById("logoutBtn");
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const exportCsvBtn = document.getElementById("exportCsvBtn");

    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }

    if (searchInput) {
        searchInput.addEventListener("input", applyFilters);
    }

    if (statusFilter) {
        statusFilter.addEventListener("change", applyFilters);
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", exportCSV);
    }

    const savedLogin = localStorage.getItem("adminLoggedIn");

    if (savedLogin === "true") {
        showAdminArea();
        loadApplications();
    }
});

function handleLogin(event) {
    event.preventDefault();

    const passwordInput = document.getElementById("adminPassword");
    const loginMessage = document.getElementById("loginMessage");

    const password = passwordInput.value.trim();

    if (!password) {
        loginMessage.textContent = "Please enter the admin password.";
        return;
    }

    localStorage.setItem("adminLoggedIn", "true");
    showAdminArea();
    loadApplications();
}

function handleLogout() {
    localStorage.removeItem("adminLoggedIn");

    document.getElementById("adminArea").classList.add("hidden");
    document.getElementById("loginSection").classList.remove("hidden");
}

function showAdminArea() {
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("adminArea").classList.remove("hidden");
}

async function loadApplications() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/applications`);

        if (!response.ok) {
            throw new Error("Could not load applications from server.");
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
        console.warn("Server applications could not be loaded. Using demo data.");
        allApplications = getDemoApplications();
    }

    currentApplications = [...allApplications];

    renderStats(allApplications);
    renderRecruitmentChart(allApplications);
    renderApplications(currentApplications);
}

function renderStats(applications) {
    const counts = {
        total: applications.length,
        new: 0,
        reviewed: 0,
        interview: 0,
        rejected: 0,
        hired: 0
    };

    applications.forEach(function (app) {
        const status = String(app.status || "New").toLowerCase();

        if (status.includes("review")) {
            counts.reviewed++;
        } else if (status.includes("interview")) {
            counts.interview++;
        } else if (status.includes("reject")) {
            counts.rejected++;
        } else if (status.includes("hire")) {
            counts.hired++;
        } else {
            counts.new++;
        }
    });

    document.getElementById("totalApplications").textContent = counts.total;
    document.getElementById("newApplications").textContent = counts.new;
    document.getElementById("reviewedApplications").textContent = counts.reviewed;
    document.getElementById("interviewApplications").textContent = counts.interview;
    document.getElementById("rejectedApplications").textContent = counts.rejected;
    document.getElementById("hiredApplications").textContent = counts.hired;
}

function renderApplications(applications) {
    const applicationsList = document.getElementById("applicationsList");

    applicationsList.innerHTML = "";

    if (!applications.length) {
        applicationsList.innerHTML = `<p class="empty-message">No applications found.</p>`;
        return;
    }

    applications.forEach(function (app) {
        const id = app.id || app._id || app.applicationId || "";
        const name = app.name || app.fullName || "Unnamed Candidate";
        const email = app.email || "No email supplied";
        const phone = app.phone || "No phone supplied";
        const role = app.role || app.position || "No role supplied";
        const status = app.status || "New";
        const date = app.createdAt || app.date || "No date supplied";
        const cvUrl = app.cvUrl || app.cv || app.fileUrl || "";

        const card = document.createElement("article");
        card.className = "application-card";

        card.innerHTML = `
            <span class="status-badge ${getStatusClass(status)}">${escapeHTML(status)}</span>

            <h3>${escapeHTML(name)}</h3>

            <p><strong>Email:</strong> ${escapeHTML(email)}</p>
            <p><strong>Phone:</strong> ${escapeHTML(phone)}</p>
            <p><strong>Role Applied For:</strong> ${escapeHTML(role)}</p>
            <p><strong>Date:</strong> ${escapeHTML(formatDate(date))}</p>

            <div class="card-actions">
                ${cvUrl ? `<a href="${escapeAttribute(cvUrl)}" target="_blank">View CV</a>` : ""}
                <button class="review-btn" onclick="updateCandidateStatus('${escapeAttribute(id)}', 'Reviewed')">Reviewed</button>
                <button class="interview-btn" onclick="updateCandidateStatus('${escapeAttribute(id)}', 'Interview Stage')">Interview</button>
                <button class="reject-btn" onclick="updateCandidateStatus('${escapeAttribute(id)}', 'Rejected')">Reject</button>
                <button class="hire-btn" onclick="updateCandidateStatus('${escapeAttribute(id)}', 'Hired')">Hire</button>
                <button class="delete-btn" onclick="deleteCandidate('${escapeAttribute(id)}')">Delete</button>
            </div>
        `;

        applicationsList.appendChild(card);
    });
}

function applyFilters() {
    const searchValue = document.getElementById("searchInput").value.toLowerCase();
    const statusValue = document.getElementById("statusFilter").value;

    currentApplications = allApplications.filter(function (app) {
        const name = String(app.name || app.fullName || "").toLowerCase();
        const email = String(app.email || "").toLowerCase();
        const role = String(app.role || app.position || "").toLowerCase();
        const status = String(app.status || "New");

        const matchesSearch =
            name.includes(searchValue) ||
            email.includes(searchValue) ||
            role.includes(searchValue);

        const matchesStatus =
            statusValue === "all" || status === statusValue;

        return matchesSearch && matchesStatus;
    });

    renderApplications(currentApplications);
}

async function updateCandidateStatus(id, newStatus) {
    if (!id) {
        updateLocalStatus(id, newStatus);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/applications/${id}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: newStatus
            })
        });

        if (!response.ok) {
            throw new Error("Server status update failed.");
        }

    } catch (error) {
        console.warn("Server update failed. Updating locally only.");
    }

    updateLocalStatus(id, newStatus);
}

function updateLocalStatus(id, newStatus) {
    allApplications = allApplications.map(function (app) {
        const appId = app.id || app._id || app.applicationId || "";

        if (appId === id) {
            return {
                ...app,
                status: newStatus
            };
        }

        return app;
    });

    currentApplications = [...allApplications];

    renderStats(allApplications);
    renderRecruitmentChart(allApplications);
    applyFilters();
}

async function deleteCandidate(id) {
    const confirmed = confirm("Are you sure you want to delete this candidate?");

    if (!confirmed) {
        return;
    }

    if (id) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/applications/${id}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error("Server delete failed.");
            }

        } catch (error) {
            console.warn("Server delete failed. Deleting locally only.");
        }
    }

    allApplications = allApplications.filter(function (app) {
        const appId = app.id || app._id || app.applicationId || "";
        return appId !== id;
    });

    currentApplications = [...allApplications];

    renderStats(allApplications);
    renderRecruitmentChart(allApplications);
    applyFilters();
}

function exportCSV() {
    if (!currentApplications.length) {
        alert("No applications to export.");
        return;
    }

    const headers = [
        "Name",
        "Email",
        "Phone",
        "Role",
        "Status",
        "Date"
    ];

    const rows = currentApplications.map(function (app) {
        return [
            app.name || app.fullName || "",
            app.email || "",
            app.phone || "",
            app.role || app.position || "",
            app.status || "New",
            app.createdAt || app.date || ""
        ];
    });

    const csvContent = [
        headers.join(","),
        ...rows.map(function (row) {
            return row.map(function (item) {
                return `"${String(item).replace(/"/g, '""')}"`;
            }).join(",");
        })
    ].join("\n");

    const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "recruitment-applications.csv";
    link.click();
}

function getStatusClass(status) {
    const cleanStatus = String(status || "New").toLowerCase();

    if (cleanStatus.includes("review")) {
        return "status-reviewed";
    }

    if (cleanStatus.includes("interview")) {
        return "status-interview";
    }

    if (cleanStatus.includes("reject")) {
        return "status-rejected";
    }

    if (cleanStatus.includes("hire")) {
        return "status-hired";
    }

    return "status-new";
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "No date supplied";
    }

    const date = new Date(dateValue);

    if (isNaN(date.getTime())) {
        return dateValue;
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
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

function getDemoApplications() {
    return [
        {
            id: "1",
            name: "Demo Candidate One",
            email: "candidate1@example.com",
            phone: "07123 456789",
            role: "Events Assistant",
            status: "New",
            createdAt: new Date().toISOString()
        },
        {
            id: "2",
            name: "Demo Candidate Two",
            email: "candidate2@example.com",
            phone: "07234 567890",
            role: "Management Trainee",
            status: "Reviewed",
            createdAt: new Date().toISOString()
        },
        {
            id: "3",
            name: "Demo Candidate Three",
            email: "candidate3@example.com",
            phone: "07345 678901",
            role: "Operations Assistant",
            status: "Interview Stage",
            createdAt: new Date().toISOString()
        },
        {
            id: "4",
            name: "Demo Candidate Four",
            email: "candidate4@example.com",
            phone: "07456 789012",
            role: "Customer Support",
            status: "Rejected",
            createdAt: new Date().toISOString()
        },
        {
            id: "5",
            name: "Demo Candidate Five",
            email: "candidate5@example.com",
            phone: "07567 890123",
            role: "Recruitment Assistant",
            status: "Hired",
            createdAt: new Date().toISOString()
        }
    ];
}
