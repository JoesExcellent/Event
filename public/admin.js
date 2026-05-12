let allApplications = [];
let currentApplications = [];

document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const logoutBtn = document.getElementById("logoutBtn");
    const exportCsvBtn = document.getElementById("exportCsvBtn");
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const clearFiltersBtn = document.getElementById("clearFiltersBtn");

    loginForm.addEventListener("submit", handleLogin);
    logoutBtn.addEventListener("click", handleLogout);
    exportCsvBtn.addEventListener("click", exportCSV);
    searchInput.addEventListener("input", applyFilters);
    statusFilter.addEventListener("change", applyFilters);
    clearFiltersBtn.addEventListener("click", clearFilters);

    if (localStorage.getItem("adminLoggedIn") === "true") {
        showAdmin();
    }
});

function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value.trim();
    const message = document.getElementById("loginMessage");

    if (!email || !password) {
        message.textContent = "Please enter your email and password.";
        return;
    }

    localStorage.setItem("adminLoggedIn", "true");
    showAdmin();
}

function showAdmin() {
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("adminArea").classList.remove("hidden");
    loadApplications();
}

function handleLogout() {
    localStorage.removeItem("adminLoggedIn");
    document.getElementById("adminArea").classList.add("hidden");
    document.getElementById("loginSection").classList.remove("hidden");
}

function loadApplications() {
    allApplications = [
        {
            id: "1",
            name: "Demo Candidate One",
            email: "candidate1@example.com",
            phone: "07123 456789",
            role: "Events Assistant",
            status: "New",
            date: "2026-05-12"
        },
        {
            id: "2",
            name: "Demo Candidate Two",
            email: "candidate2@example.com",
            phone: "07234 567890",
            role: "Management Trainee",
            status: "Reviewed",
            date: "2026-05-12"
        },
        {
            id: "3",
            name: "Demo Candidate Three",
            email: "candidate3@example.com",
            phone: "07345 678901",
            role: "Operations Assistant",
            status: "Interview Stage",
            date: "2026-05-12"
        },
        {
            id: "4",
            name: "Demo Candidate Four",
            email: "candidate4@example.com",
            phone: "07456 789012",
            role: "Customer Support",
            status: "Rejected",
            date: "2026-05-12"
        },
        {
            id: "5",
            name: "Demo Candidate Five",
            email: "candidate5@example.com",
            phone: "07567 890123",
            role: "Recruitment Assistant",
            status: "Hired",
            date: "2026-05-12"
        }
    ];

    currentApplications = [...allApplications];

    renderStats();
    renderApplications();
    renderRecruitmentChart(allApplications);
}

function renderStats() {
    const total = allApplications.length;
    const newCount = countStatus("New");
    const reviewed = countStatus("Reviewed");
    const interview = countStatus("Interview Stage");
    const rejected = countStatus("Rejected");
    const hired = countStatus("Hired");

    document.getElementById("totalApplications").textContent = total;
    document.getElementById("newApplications").textContent = newCount;
    document.getElementById("reviewedApplications").textContent = reviewed;
    document.getElementById("interviewApplications").textContent = interview;
    document.getElementById("rejectedApplications").textContent = rejected;
    document.getElementById("hiredApplications").textContent = hired;
}

function countStatus(statusName) {
    return allApplications.filter(function (app) {
        return app.status === statusName;
    }).length;
}

function renderApplications() {
    const list = document.getElementById("applicationsList");
    const showingCount = document.getElementById("showingCount");

    list.innerHTML = "";

    showingCount.textContent = `Showing ${currentApplications.length} of ${allApplications.length} applications`;

    currentApplications.forEach(function (app) {
        const card = document.createElement("div");
        card.className = "candidate-card";

        card.innerHTML = `
            <span class="status-badge ${getStatusClass(app.status)}">${app.status}</span>
            <h3>${app.name}</h3>
            <p><strong>Email:</strong> ${app.email}</p>
            <p><strong>Phone:</strong> ${app.phone}</p>
            <p><strong>Role Applied For:</strong> ${app.role}</p>
            <p><strong>Date:</strong> ${formatDate(app.date)}</p>

            <div class="candidate-actions">
                <button class="save-btn" onclick="saveCandidate('${app.id}')">Save Updates</button>
                <button class="reject-btn" onclick="updateStatus('${app.id}', 'Rejected')">Reject Candidate</button>
                <button class="invite-btn" onclick="updateStatus('${app.id}', 'Interview Stage')">Invite to Interview</button>
                <button class="delete-btn" onclick="deleteCandidate('${app.id}')">Delete Candidate</button>
            </div>
        `;

        list.appendChild(card);
    });
}

function updateStatus(id, status) {
    allApplications = allApplications.map(function (app) {
        if (app.id === id) {
            app.status = status;
        }

        return app;
    });

    applyFilters();
    renderStats();
    renderRecruitmentChart(allApplications);
}

function saveCandidate(id) {
    alert("Candidate updates saved successfully.");
}

function deleteCandidate(id) {
    const confirmed = confirm("Are you sure you want to delete this candidate?");

    if (!confirmed) {
        return;
    }

    allApplications = allApplications.filter(function (app) {
        return app.id !== id;
    });

    applyFilters();
    renderStats();
    renderRecruitmentChart(allApplications);
}

function applyFilters() {
    const searchValue = document.getElementById("searchInput").value.toLowerCase();
    const statusValue = document.getElementById("statusFilter").value;

    currentApplications = allApplications.filter(function (app) {
        const matchesSearch =
            app.name.toLowerCase().includes(searchValue) ||
            app.email.toLowerCase().includes(searchValue) ||
            app.role.toLowerCase().includes(searchValue);

        const matchesStatus =
            statusValue === "all" || app.status === statusValue;

        return matchesSearch && matchesStatus;
    });

    renderApplications();
}

function clearFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("statusFilter").value = "all";

    currentApplications = [...allApplications];

    renderApplications();
}

function exportCSV() {
    let csv = "Name,Email,Phone,Role,Status,Date\n";

    currentApplications.forEach(function (app) {
        csv += `"${app.name}","${app.email}","${app.phone}","${app.role}","${app.status}","${app.date}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "applications.csv";
    link.click();
}

function getStatusClass(status) {
    if (status === "Reviewed") return "status-reviewed";
    if (status === "Interview Stage") return "status-interview";
    if (status === "Rejected") return "status-rejected";
    if (status === "Hired") return "status-hired";

    return "status-new";
}

function formatDate(dateValue) {
    const date = new Date(dateValue);

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}
