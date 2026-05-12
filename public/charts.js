let recruitmentChart = null;
function renderRecruitmentChart(applications = []) {
    const canvas = document.getElementById("recruitmentChart");
    if (!canvas || typeof Chart === "undefined") return;
    const counts = { new:0, reviewed:0, interview:0, rejected:0, hired:0 };
    applications.forEach(app => {
        const status = String(app.status || "New").toLowerCase();
        if (status.includes("review")) counts.reviewed++;
        else if (status.includes("interview")) counts.interview++;
        else if (status.includes("reject")) counts.rejected++;
        else if (status.includes("hire")) counts.hired++;
        else counts.new++;
    });
    if (recruitmentChart) recruitmentChart.destroy();
    recruitmentChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: ["New", "Reviewed", "Interview", "Rejected", "Hired"],
            datasets: [{
                label: "Candidates",
                data: [counts.new, counts.reviewed, counts.interview, counts.rejected, counts.hired],
                backgroundColor: ["#00d9ff", "#ffc400", "#9c27b0", "#c9342b", "#3fa34d"],
                borderColor: ["#00d9ff", "#ffc400", "#9c27b0", "#c9342b", "#3fa34d"],
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#ffffff", font: { size: 11, weight: "bold" } } },
                title: { display: true, text: "Recruitment Status Breakdown", color: "#ffffff", font: { size: 15, weight: "bold" } }
            },
            scales: {
                x: { ticks: { color: "#ffffff", font: { size: 10, weight: "bold" } }, grid: { color: "rgba(255,255,255,.06)" } },
                y: { beginAtZero: true, ticks: { color: "#ffffff", stepSize: 1, precision: 0 }, grid: { color: "rgba(255,255,255,.12)" } }
            }
        }
    });
}
