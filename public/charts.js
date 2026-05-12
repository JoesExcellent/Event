/* =====================================================
   TEMC RECRUITMENT ANALYTICS CHART
   Works with admin.js and the existing #applicationsChart canvas.
===================================================== */

let temcApplicationsChart = null;

function normaliseStatus(status) {
    const value = String(status || "New").toLowerCase();

    if (value.includes("review")) return "Reviewed";
    if (value.includes("interview") || value.includes("to be")) return "Interview";
    if (value.includes("reject")) return "Rejected";
    if (value.includes("hire")) return "Hired";

    return "New";
}

function renderApplicationsChart(applications = []) {
    const canvas = document.getElementById("applicationsChart");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    const counts = {
        New: 0,
        Reviewed: 0,
        Interview: 0,
        Rejected: 0,
        Hired: 0
    };

    applications.forEach(app => {
        const status = normaliseStatus(app.status);
        counts[status] += 1;
    });

    if (temcApplicationsChart) {
        temcApplicationsChart.destroy();
    }

    temcApplicationsChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: ["New", "Reviewed", "Interview", "Rejected", "Hired"],
            datasets: [{
                label: "Candidates",
                data: [
                    counts.New,
                    counts.Reviewed,
                    counts.Interview,
                    counts.Rejected,
                    counts.Hired
                ],
                backgroundColor: [
                    "#ff6600",
                    "#00cfff",
                    "#27ae60",
                    "#c0392b",
                    "#f1c40f"
                ],
                borderColor: [
                    "#ff6600",
                    "#00cfff",
                    "#27ae60",
                    "#c0392b",
                    "#f1c40f"
                ],
                borderWidth: 1,
                borderRadius: 8,
                barThickness: 42,
                maxBarThickness: 52
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#ffffff",
                        font: {
                            size: 13,
                            weight: "bold"
                        }
                    }
                },
                title: {
                    display: true,
                    text: "Recruitment Status Breakdown",
                    color: "#ffffff",
                    font: {
                        size: 16,
                        weight: "bold"
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#ffffff",
                        font: {
                            size: 12,
                            weight: "bold"
                        }
                    },
                    grid: {
                        color: "rgba(255,255,255,0.06)"
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#ffffff",
                        stepSize: 1,
                        precision: 0
                    },
                    grid: {
                        color: "rgba(255,255,255,0.12)"
                    }
                }
            }
        }
    });
}
