
/* =====================================================
   TEMC ADMIN.JS
   MULTI ROLE LOGIN SYSTEM
===================================================== */
const API_BASE_URL = "https://event-production-111a.up.railway.app";
const ADMIN_USERS = [
    {
        email: "joseph.eldridge1964@gmail.com",
        password: "temc2026",
        role: "OWNER",
        roleClass: "role-owner",
        permissions: [
            "Full dashboard access",
            "Manage recruiters",
            "Delete candidates",
            "Export reports"
        ]
    },

    {
        email: "recruiter@temc.co.uk",
        password: "recruit2026",
        role: "RECRUITER",
        roleClass: "role-recruiter",
        permissions: [
            "Review applications",
            "Invite candidates",
            "Update notes"
        ]
    },

    {
        email: "viewer@temc.co.uk",
        password: "viewer2026",
        role: "VIEWER",
        roleClass: "role-viewer",
        permissions: [
            "View dashboard only"
        ]
    }
];

let currentAdmin = null;

async function loginAdmin() {

    const emailField = document.getElementById("adminEmail");
    const passwordField = document.getElementById("adminPassword");
    const message = document.getElementById("loginMessage");

    const email = emailField.value.trim().toLowerCase();
    const password = passwordField.value.trim();

    const matchedUser = ADMIN_USERS.find(function(user) {
        return (
            user.email.toLowerCase() === email &&
            user.password === password
        );
    });

    if (!matchedUser) {

        message.textContent = "Incorrect email or password.";
        message.className = "error-message";
        return;
    }

    currentAdmin = matchedUser;
   const backendResponse = await fetch(`${API_BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },

     const backendData = await backendResponse.json();

if (!backendData.success) {

    message.textContent = "Backend login failed";
    message.className = "error-message";
    return;
}
    body: JSON.stringify({
        email,
        password
    })
});

const backendData = await backendResponse.json();

    localStorage.setItem("temcAdminLoggedIn", "true");
    localStorage.setItem("temcAdminRole", matchedUser.role);
    localStorage.setItem("temcAdminEmail", matchedUser.email);

    document.getElementById("loginBox").style.display = "none";
    document.getElementById("dashboardContent").style.display = "block";

    renderAdminRoleInfo();
loadApplications();

    message.textContent = "";
}

function logoutAdmin() {

    localStorage.removeItem("temcAdminLoggedIn");
    localStorage.removeItem("temcAdminRole");
    localStorage.removeItem("temcAdminEmail");

    document.getElementById("dashboardContent").style.display = "none";
    document.getElementById("loginBox").style.display = "block";
}

function renderAdminRoleInfo() {

    const adminInfo = document.getElementById("adminInfo");
    const permissionsInfo = document.getElementById("permissionsInfo");

    if (!currentAdmin) return;

    adminInfo.innerHTML = `
        <strong>Email:</strong> ${currentAdmin.email}
        <span class="role-badge ${currentAdmin.roleClass}">
            ${currentAdmin.role}
        </span>
    `;

    permissionsInfo.innerHTML = `
        <h3>Permissions</h3>
        <ul>
            ${currentAdmin.permissions.map(function(permission) {
                return `<li>${permission}</li>`;
            }).join("")}
        </ul>
    `;
}

document.addEventListener("DOMContentLoaded", function () {

    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logoutAdmin);
    }

    const savedLogin = localStorage.getItem("temcAdminLoggedIn");
    const savedEmail = localStorage.getItem("temcAdminEmail");

    if (savedLogin === "true" && savedEmail) {

        const matchedUser = ADMIN_USERS.find(function(user) {
            return user.email === savedEmail;
        });

        if (matchedUser) {

            currentAdmin = matchedUser;

            document.getElementById("loginBox").style.display = "none";
            document.getElementById("dashboardContent").style.display = "block";

            renderAdminRoleInfo();
        }
    }
});
async function loadApplications() {
    console.log("loadApplications function is running");

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/applications`);

        console.log("Applications response status:", response.status);

        const data = await response.json();

        console.log("Applications data:", data);

    } catch (error) {
        console.error("Failed to load applications:", error);
    }
}
