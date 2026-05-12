/* =====================================================
   TEMC RECRUITMENT ANALYTICS CHART
   File: public/charts.js
===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    const chartCanvas = document.getElementById("applicationsChart");

    if (!chartCanvas) {
        return;
    }

    if (typeof Chart === "undefined") {
        console.warn("Chart.js has not loaded.");
        return;
    }

    const chartContext = chartCanvas.getContext("2d");

    new Chart(chartContext, {
        type: "bar",

        data: {
            labels: [
                "New",
                "Reviewed",
                "Interview",
                "Hired"
            ],

            datasets: [
                {
                    label: "Candidates",

                    data: [
                        12,
                        8,
                        5,
                        2
                    ],

                    backgroundColor: [
                        "#ff6a00",
                        "#1cc8ee",
                        "#29b765",
                        "#f1c40f"
                    ],

                    borderWidth: 0,

                    borderRadius: 6
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: true,

                    labels: {
                        color: "#ffffff",
                        font: {
                            size: 12,
                            weight: "bold"
                        }
                    }
                },

                tooltip: {
                    enabled: true
                }
            },

            scales: {
                x: {
                    ticks: {
                        color: "#ffffff",
                        font: {
                            size: 11
                        }
                    },

                    grid: {
                        color: "rgba(255,255,255,0.08)"
                    }
                },

                y: {
                    beginAtZero: true,

                    ticks: {
                        color: "#ffffff",
                        stepSize: 1,
                        font: {
                            size: 11
                        }
                    },

                    grid: {
                        color: "rgba(255,255,255,0.08)"
                    }
                }
            }
        }
    });
});