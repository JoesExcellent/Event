/* =====================================================
   TEMC RECRUITMENT ANALYTICS CHART
===================================================== */

let recruitmentAnalyticsChart = null;

function countApplicationsByStatus(applications) {
    return {
        newCount: applications.filter(app => (app.status || "New") === "New").length,
        reviewedCount: applications.filter(app => app.status === "Reviewed").length,
        interviewCount: applications.filter(app =>
            app.status === "To Be Interviewed" ||
            app.status === "Interview Invited"
        ).length,
        rejectedCount: applications.filter(app => app.status === "Rejected").length,
        hiredCount: applications.filter(app => app.status === "Hired").length
    };
}

function renderRecruitmentAnalytics(applications = []) {
    const canvas = document.getElementById("applicationsChart");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    const ctx = canvas.getContext("2d");
    const counts = countApplicationsByStatus(applications);

    const chartData = {
        labels: ["New", "Reviewed", "Interview Stage", "Rejected", "Hired"],
        datasets: [{
            label: "Applications",
            data: [
                counts.newCount,
                counts.reviewedCount,
                counts.interviewCount,
                counts.rejectedCount,
                counts.hiredCount
            ],
            borderWidth: 1
        }]
    };

    if (recruitmentAnalyticsChart) {
        recruitmentAnalyticsChart.data = chartData;
        recruitmentAnalyticsChart.update();
        return;
    }

    recruitmentAnalyticsChart = new Chart(ctx, {
        type: "bar",
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: "Recruitment Status Breakdown"
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

window.renderRecruitmentAnalytics = renderRecruitmentAnalytics;
