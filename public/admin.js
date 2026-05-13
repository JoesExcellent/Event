# Full Working public/admin.js

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "temc-recruitment-system.firebaseapp.com",
    projectId: "temc-recruitment-system",
    storageBucket: "temc-recruitment-system.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

let currentAdmin = null;
let applications = [];
let applicationsChart = null;

const adminAccounts = {
    "joseph.eldridge1964@gmail.com": {
        password: "temc2026",
        role: "OWNER",
        permissions: [
            "Full dashboard access",
            "Manage recruiters",
            "Delete candidates",
            "Export reports"
        ]
    },

    "recruiter@temc.co.uk": {
        password: "recruit2026",
        role: "RECRUITER",
        permissions: [
            "Review applications",
            "Update candidate status",
            "Invite candidates to interview"
        ]
    },

    "viewer@temc.co.uk": {
        password: "viewer2026",
        role: "VIEWER",
        permissions: [
            "View dashboard only"
        ]
    }
};

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");

    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

function loginAdmin() {
    const emailInput = document.getElementById("adminEmail");
    const passwordInput = document.getElementById("adminPassword");
    const loginMessage = document.getElementById("loginMessage");

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();

    const account = adminAccounts[email];

    if (!account) {
        loginMessage.innerHTML = "Invalid email";
        loginMessage.className = "error-message";
        return;
    }

    if (account.password !== password) {
        loginMessage.innerHTML = "Incorrect password";
        loginMessage.className = "error-message";
        return;
    }

    currentAdmin = {
        email,
        role: account.role,
        permissions: account.permissions
    };

    localStorage.setItem("temcAdmin", JSON.stringify(currentAdmin));

    document.getElementById("loginBox").style.display = "none";
    document.getElementById("dashboardContent").style.display = "block";

    renderAdminInfo();
    loadApplications();

    loginMessage.innerHTML = "";

    showToast("Login successful", "success");
}

function logoutAdmin() {
    localStorage.removeItem("temcAdmin");
    location.reload();
}

function renderAdminInfo() {
    const adminInfo = document.getElementById("adminInfo");
    const permissionsInfo = document.getElementById("permissionsInfo");

    if (!currentAdmin) return;

    let roleClass = "role-viewer";

    if (currentAdmin.role === "OWNER") {
        roleClass = "role-owner";
    }

    if (currentAdmin.role === "RECRUITER") {
        roleClass = "role-recruiter";
    }

    adminInfo.innerHTML = `
        <strong>Email:</strong> ${currentAdmin.email}
        <span class="role-badge ${roleClass}">
            ${currentAdmin.role}
        </span>
    `;

    permissionsInfo.innerHTML = `
        <h3>Permissions</h3>
        <ul>
            ${currentAdmin.permissions
                .map(permission => `<li>${permission}</li>`)
                .join("")}
        </ul>
    `;
}

async function loadApplications() {
    try {
        const snapshot = await db
            .collection("applications")
            .orderBy("createdAt", "desc")
            .get();

        applications = [];

        snapshot.forEach(doc => {
            applications.push({
                id: doc.id,
                ...doc.data()
            });
        });

        renderStats();
        renderApplications();
        renderChart();

        showToast("Applications loaded", "info");

    } catch (error) {
        console.error(error);
        showToast("Failed to load applications", "error");
    }
}

function renderStats() {
    const stats = document.getElementById("stats");

    const total = applications.length;

    const newCount = applications.filter(app => app.status === "New").length;

    const reviewedCount = applications.filter(app => app.status === "Reviewed").length;

    const interviewCount = applications.filter(app => app.status === "Interview").length;

    const rejectedCount = applications.filter(app => app.status === "Rejected").length;

    const hiredCount = applications.filter(app => app.status === "Hired").length;

    stats.innerHTML = `
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
                <h3>Rejected</h3>
                <p>${rejectedCount}</p>
            </div>

            <div class="stat-card">
                <h3>Hired</h3>
                <p>${hiredCount}</p>
            </div>

        </div>
    `;
}

function renderChart() {
    const canvas = document.getElementById("applicationsChart");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const newCount = applications.filter(app => app.status === "New").length;

    const reviewedCount = applications.filter(app => app.status === "Reviewed").length;

    const interviewCount = applications.filter(app => app.status === "Interview").length;

    const rejectedCount = applications.filter(app => app.status === "Rejected").length;

    const hiredCount = applications.filter(app => app.status === "Hired").length;

    if (applicationsChart) {
        applicationsChart.destroy();
    }

    applicationsChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: [
                "New",
                "Reviewed",
                "Interview",
                "Rejected",
                "Hired"
            ],
            datasets: [{
                label: "Candidates",
                data: [
                    newCount,
                    reviewedCount,
                    interviewCount,
                    rejectedCount,
                    hiredCount
                ],
                backgroundColor: [
                    "#ff6a00",
                    "#00d9ff",
                    "#30b566",
                    "#cf352b",
                    "#f1c40f"
                ],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "white"
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "white"
                    },
                    grid: {
                        color: "rgba(255,255,255,0.08)"
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "white"
                    },
                    grid: {
                        color: "rgba(255,255,255,0.08)"
                    }
                }
            }
        }
    });
}

function renderApplications() {
    const applicationsContainer = document.getElementById("applications");

    if (!applicationsContainer) return;

    if (applications.length === 0) {
        applicationsContainer.innerHTML = `
            <div class="application-card">
                <h2>No applications found</h2>
            </div>
        `;
        return;
    }

    applicationsContainer.innerHTML = applications.map(application => {

        const status = application.status || "New";

        return `
            <div class="application-card candidate-card">

                <h2>${application.fullName || "Unnamed Candidate"}</h2>

                <div class="text-placeholder">
                    Add recruiter observations, candidate summary notes,
                    assessment information and interview highlights here.
                </div>

                <p><strong>Email:</strong> ${application.email || "N/A"}</p>

                <p><strong>Phone:</strong> ${application.phone || "N/A"}</p>

                <p><strong>Position:</strong> ${application.position || "N/A"}</p>

                <p><strong>About:</strong> ${application.message || "No message provided."}</p>

                <p><strong>Status:</strong> ${status}</p>

                <p><strong>Applied:</strong>
                    ${application.createdAt
                        ? new Date(application.createdAt.seconds * 1000).toLocaleString()
                        : "Unknown"
                    }
                </p>

                ${application.cvUrl
                    ? `<p><a href="${application.cvUrl}" target="_blank">View CV</a></p>`
                    : ""
                }

                <div class="candidate-actions">
                    <button onclick="updateStatus('${application.id}', 'Reviewed')">
                        Reviewed
                    </button>

                    <button onclick="updateStatus('${application.id}', 'Interview')">
                        Interview
                    </button>

                    <button onclick="updateStatus('${application.id}', 'Rejected')">
                        Reject
                    </button>

                    <button onclick="updateStatus('${application.id}', 'Hired')">
                        Hire
                    </button>
                </div>

            </div>
        `;

    }).join("");
}

async function updateStatus(applicationId, newStatus) {
    try {

        await db.collection("applications")
            .doc(applicationId)
            .update({
                status: newStatus
            });

        showToast(`Candidate updated to ${newStatus}`, "success");

        loadApplications();

    } catch (error) {
        console.error(error);
        showToast("Failed to update candidate", "error");
    }
}

function exportCSV() {

    if (applications.length === 0) {
        showToast("No applications to export", "error");
        return;
    }

    const headers = [
        "Name",
        "Email",
        "Phone",
        "Position",
        "Status"
    ];

    const rows = applications.map(app => [
        app.fullName || "",
        app.email || "",
        app.phone || "",
        app.position || "",
        app.status || "New"
    ]);

    let csvContent = headers.join(",") + "\n";

    rows.forEach(row => {
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;"
    });

    const link = document.createElement("a");

    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", "applications.csv");

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
}

window.addEventListener("load", () => {

    const savedAdmin = localStorage.getItem("temcAdmin");

    if (savedAdmin) {

        currentAdmin = JSON.parse(savedAdmin);

        document.getElementById("loginBox").style.display = "none";
        document.getElementById("dashboardContent").style.display = "block";

        renderAdminInfo();
        loadApplications();
    }

    const logoutBtn = document.getElementById("logoutBtn");
    const exportBtn = document.getElementById("exportCsvBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logoutAdmin);
    }

    if (exportBtn) {
        exportBtn.addEventListener("click", exportCSV);
    }
});
```

Replace only:

`public/admin.js`

Do not replace:

* admin.html
* style.css
* charts.js
