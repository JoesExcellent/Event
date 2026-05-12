function renderRecruitmentChart(applications) {

    const ctx = document.getElementById("recruitmentChart");

    if (!ctx) return;

    const counts = {
        new: 0,
        reviewed: 0,
        interview: 0,
        rejected: 0,
        hired: 0
    };

    applications.forEach(app => {

        const status = (app.status || "").toLowerCase();

        if (status.includes("new")) counts.new++;
        else if (status.includes("review")) counts.reviewed++;
        else if (status.includes("interview")) counts.interview++;
        else if (status.includes("reject")) counts.rejected++;
        else if (status.includes("hire")) counts.hired++;
    });

    if (window.recruitmentChart instanceof Chart) {
        window.recruitmentChart.destroy();
    }

    window.recruitmentChart = new Chart(ctx, {
        type: "bar",

        data: {
            labels: [
                "New",
                "Reviewed",
                "Interview Stage",
                "Rejected",
                "Hired"
            ],

            datasets: [{
                label: "Candidates",

                data: [
                    counts.new,
                    counts.reviewed,
                    counts.interview,
                    counts.rejected,
                    counts.hired
                ],

                backgroundColor: [
                    "rgba(0, 200, 255, 0.8)",     // Blue
                    "rgba(255, 193, 7, 0.8)",     // Gold
                    "rgba(156, 39, 176, 0.8)",    // Purple
                    "rgba(244, 67, 54, 0.8)",     // Red
                    "rgba(76, 175, 80, 0.8)"      // Green
                ],

                borderColor: [
                    "#00c8ff",
                    "#ffc107",
                    "#9c27b0",
                    "#f44336",
                    "#4caf50"
                ],

                borderWidth: 2,
                borderRadius: 10
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
                            size: 14,
                            weight: "bold"
                        }
                    }
                }
            },

            scales: {

                x: {
                    ticks: {
                        color: "#ffffff",
                        font: {
                            size: 16,
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
