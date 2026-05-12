const ADMIN_EMAIL = "joseph.eldridge1964@gmail.com";
const ADMIN_PASSWORD = "password123";
let allApplications = [];
let currentApplications = [];

document.addEventListener("DOMContentLoaded", () => {
    byId("loginForm").addEventListener("submit", handleLogin);
    byId("logoutBtn").addEventListener("click", logout);
    byId("exportCsvBtn").addEventListener("click", exportCSV);
    byId("searchInput").addEventListener("input", applyFilters);
    byId("statusFilter").addEventListener("change", applyFilters);
    byId("clearFiltersBtn").addEventListener("click", clearFilters);
    if (localStorage.getItem("excellentAdminLoggedIn") === "true") showAdmin();
});

function byId(id){ return document.getElementById(id); }

function handleLogin(event){
    event.preventDefault();
    const email = byId("adminEmail").value.trim().toLowerCase();
    const password = byId("adminPassword").value.trim();
    const message = byId("loginMessage");
    if (!email || !password){ message.textContent = "Please enter your email and password."; return; }
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD){ message.textContent = "Incorrect email or password."; return; }
    localStorage.setItem("excellentAdminLoggedIn", "true");
    message.textContent = "";
    showAdmin();
}

function showAdmin(){
    byId("loginSection").classList.add("hidden");
    byId("adminArea").classList.remove("hidden");
    loadApplications();
}

function logout(){
    localStorage.removeItem("excellentAdminLoggedIn");
    byId("adminArea").classList.add("hidden");
    byId("loginSection").classList.remove("hidden");
}

async function loadApplications(){
    try {
        const response = await fetch("/admin/applications");
        if (!response.ok) throw new Error("No server data");
        const data = await response.json();
        allApplications = Array.isArray(data) ? data : (data.applications || []);
        if (!allApplications.length) allApplications = demoApplications();
    } catch(error) {
        allApplications = demoApplications();
    }
    currentApplications = [...allApplications];
    refreshDashboard();
}

function refreshDashboard(){
    renderStats();
    renderApplications();
    renderRecruitmentChart(allApplications);
}

function renderStats(){
    byId("totalApplications").textContent = allApplications.length;
    byId("newApplications").textContent = countStatus("New");
    byId("reviewedApplications").textContent = countStatus("Reviewed");
    byId("interviewApplications").textContent = countStatus("Interview Stage");
    byId("rejectedApplications").textContent = countStatus("Rejected");
    byId("hiredApplications").textContent = countStatus("Hired");
}

function countStatus(status){ return allApplications.filter(app => normalStatus(app.status) === status).length; }
function normalStatus(status){ return status || "New"; }

function renderApplications(){
    const list = byId("applicationsList");
    list.innerHTML = "";
    byId("showingCount").textContent = `Showing ${currentApplications.length} of ${allApplications.length} applications`;
    if (!currentApplications.length){ list.innerHTML = '<p>No applications found.</p>'; return; }
    currentApplications.forEach(app => {
        const card = document.createElement("article");
        card.className = "candidate-card";
        card.innerHTML = `
            <div class="candidate-top">
                <div class="candidate-photo-placeholder">Candidate Photograph Placeholder</div>
                <div>
                    <span class="status-badge ${statusClass(app.status)}">${safe(normalStatus(app.status))}</span>
                    <h3>${safe(app.name || app.fullName || "Unnamed Candidate")}</h3>
                    <p><strong>Email:</strong> ${safe(app.email || "Not supplied")}</p>
                    <p><strong>Phone:</strong> ${safe(app.phone || "Not supplied")}</p>
                    <p><strong>Role Applied For:</strong> ${safe(app.role || app.position || "Not supplied")}</p>
                    <p><strong>Date:</strong> ${formatDate(app.date || app.createdAt)}</p>
                </div>
            </div>
            <div class="candidate-form">
                <label>Status<select data-field="status" data-id="${safeAttr(app.id)}"><option>New</option><option>Reviewed</option><option>Interview Stage</option><option>Rejected</option><option>Hired</option></select></label>
                <label>Rating<input data-field="rating" data-id="${safeAttr(app.id)}" type="number" min="1" max="5" value="${safeAttr(app.rating || "")}"></label>
                <label>Interview Date<input data-field="interviewDate" data-id="${safeAttr(app.id)}" type="date" value="${safeAttr(app.interviewDate || "")}"></label>
                <label>Interview Time<input data-field="interviewTime" data-id="${safeAttr(app.id)}" type="time" value="${safeAttr(app.interviewTime || "")}"></label>
                <label class="wide">Notes<textarea data-field="notes" data-id="${safeAttr(app.id)}">${safe(app.notes || "")}</textarea></label>
            </div>
            <div class="candidate-actions">
                <button class="orange-btn" onclick="saveCandidate('${safeAttr(app.id)}')">Save Updates</button>
                <button class="danger-btn" onclick="setStatus('${safeAttr(app.id)}','Rejected')">Reject Candidate</button>
                <button class="orange-btn" onclick="setStatus('${safeAttr(app.id)}','Interview Stage')">Invite to Interview</button>
                <button class="orange-btn" onclick="deleteCandidate('${safeAttr(app.id)}')">Delete Candidate</button>
            </div>`;
        const select = card.querySelector('select[data-field="status"]');
        if (select) select.value = normalStatus(app.status);
        list.appendChild(card);
    });
}

function applyFilters(){
    const search = byId("searchInput").value.toLowerCase();
    const status = byId("statusFilter").value;
    currentApplications = allApplications.filter(app => {
        const text = `${app.name || app.fullName || ""} ${app.email || ""} ${app.phone || ""} ${app.role || app.position || ""}`.toLowerCase();
        return text.includes(search) && (status === "all" || normalStatus(app.status) === status);
    });
    renderApplications();
}

function clearFilters(){ byId("searchInput").value=""; byId("statusFilter").value="all"; currentApplications=[...allApplications]; renderApplications(); }

function setStatus(id,status){ const app = allApplications.find(a => String(a.id) === String(id)); if(app) app.status=status; currentApplications=[...allApplications]; refreshDashboard(); }
function saveCandidate(id){
    const app = allApplications.find(a => String(a.id) === String(id));
    if (!app) return;
    document.querySelectorAll(`[data-id="${CSS.escape(String(id))}"]`).forEach(input => { app[input.dataset.field] = input.value; });
    renderStats(); renderRecruitmentChart(allApplications); alert("Candidate updates saved successfully.");
}
function deleteCandidate(id){ if(!confirm("Are you sure you want to delete this candidate?")) return; allApplications = allApplications.filter(a => String(a.id) !== String(id)); currentApplications=[...allApplications]; refreshDashboard(); }

function exportCSV(){
    const rows = [["Name","Email","Phone","Role","Status","Rating","Interview Date","Interview Time","Notes"]];
    currentApplications.forEach(a => rows.push([a.name||a.fullName||"",a.email||"",a.phone||"",a.role||a.position||"",normalStatus(a.status),a.rating||"",a.interviewDate||"",a.interviewTime||"",a.notes||""]));
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "recruitment-applications.csv";
    link.click();
}

function statusClass(status){ const s = normalStatus(status); if(s==="Reviewed") return "status-reviewed"; if(s==="Interview Stage") return "status-interview"; if(s==="Rejected") return "status-rejected"; if(s==="Hired") return "status-hired"; return "status-new"; }
function formatDate(value){ const date = value ? new Date(value) : new Date(); return isNaN(date) ? safe(value) : date.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); }
function safe(value){ return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function safeAttr(value){ return safe(value).replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }

function demoApplications(){
    return [
        {id:"1",name:"Demo Candidate One",email:"candidate1@example.com",phone:"07123 456789",role:"Events Assistant",status:"New",date:"2026-05-12"},
        {id:"2",name:"Demo Candidate Two",email:"candidate2@example.com",phone:"07234 567890",role:"Management Trainee",status:"Reviewed",date:"2026-05-12"},
        {id:"3",name:"Demo Candidate Three",email:"candidate3@example.com",phone:"07345 678901",role:"Operations Assistant",status:"Interview Stage",date:"2026-05-12"},
        {id:"4",name:"Demo Candidate Four",email:"candidate4@example.com",phone:"07456 789012",role:"Customer Support",status:"Rejected",date:"2026-05-12"},
        {id:"5",name:"Demo Candidate Five",email:"candidate5@example.com",phone:"07567 890123",role:"Recruitment Assistant",status:"Hired",date:"2026-05-12"}
    ];
}
