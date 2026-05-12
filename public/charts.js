let applicationsChart = null;

function statusBucket(status) {
    const value = String(status || "New").toLowerCase();
    if (value.includes("review")) return "reviewed";
    if (value.includes("interview") || value.includes("invited")) return "interview";
    if (value.includes("reject")) return "rejected";
    if (value.includes("hire")) return "hired";
    return "new";
}

function getApplicationCounts(applications = []) {
    const counts = {
        new: 0,
        reviewed: 0,
        interview: 0,
        rejected: 0,
        hired: 0
    };

    applications.forEach(app => {
        counts[statusBucket(app.status)] += 1;
    });

    return counts;
}

function renderApplicationsChart(applications = []) {
    const canvas = document.getElementById("applicationsChart");
    if (!canvas || typeof Chart === "undefined") return;

    const counts = getApplicationCounts(applications);

    if (applicationsChart) {
        applicationsChart.destroy();
    }

    applicationsChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: ["New", "Reviewed", "Interview Stage", "Rejected", "Hired"],
            datasets: [{
                label: "Candidates",
                data: [counts.new, counts.reviewed, counts.interview, counts.rejected, counts.hired],
                backgroundColor: ["#00d9ff", "#ffc400", "#9c27b0", "#cf352b", "#3fa34d"],
                borderColor: ["#00d9ff", "#ffc400", "#9c27b0", "#cf352b", "#3fa34d"],
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#ffffff",
                        font: { size: 12, weight: "bold" }
                    }
                },
                title: {
                    display: true,
                    text: "Recruitment Status Breakdown",
                    color: "#ffffff",
                    font: { size: 16, weight: "bold" },
                    padding: { bottom: 12 }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#ffffff",
                        font: { size: 11, weight: "bold" }
                    },
                    grid: { color: "rgba(255,255,255,0.08)" }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#ffffff",
                        stepSize: 1,
                        precision: 0
                    },
                    grid: { color: "rgba(255,255,255,0.12)" }
                }
            }
        }
    });
}
