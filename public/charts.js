let recruitmentChart = null;

function renderRecruitmentChart(applications = []) {
    const canvas = document.getElementById("recruitmentChart");

    if (!canvas) {
        console.error("Chart canvas not found.");
        return;
    }

    const counts = {
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

    if (recruitmentChart) {
        recruitmentChart.destroy();
    }

    recruitmentChart = new Chart(canvas, {
        type: "bar",

        data: {
            labels: [
                "New",
                "Reviewed",
                "Interview Stage",
                "Rejected",
                "Hired"
            ],

            datasets: [
                {
                    label: "Candidates",

                    data: [
                        counts.new,
                        counts.reviewed,
                        counts.interview,
                        counts.rejected,
                        counts.hired
                    ],

                    backgroundColor: [
                        "rgba(0, 200, 255, 0.85)",
                        "rgba(255, 193, 7, 0.85)",
                        "rgba(156, 39, 176, 0.85)",
                        "rgba(244, 67, 54, 0.85)",
                        "rgba(76, 175, 80, 0.85)"
                    ],

                    borderColor: [
                        "#00c8ff",
                        "#ffc107",
                        "#9c27b0",
                        "#f44336",
                        "#4caf50"
                    ],

                    borderWidth: 2,
                    borderRadius: 12,
                    borderSkipped: false
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    labels: {
                        color: "#ffffff",
                        font: {
                            size: 14,
                            weight: "bold"
                        }
                    }
                },

                title: {
                    display: true,
                    text: "Recruitment Status Breakdown",
                    color: "#ffffff",
                    font: {
                        size: 22,
                        weight: "bold"
                    },
                    padding: {
                        top: 10,
                        bottom: 25
                    }
                }
            },

            scales: {
                x: {
                    ticks: {
                        color: "#ffffff",
                        font: {
                            size: 15,
                            weight: "bold"
                        }
                    },
                    grid: {
                        color: "rgba(255,255,255,0.05)"
                    }
                },

                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#ffffff",
                        stepSize: 1,
                        precision: 0,
                        font: {
                            size: 14
                        }
                    },
                    grid: {
                        color: "rgba(255,255,255,0.08)"
                    }
                }
            }
        }
    });
}
