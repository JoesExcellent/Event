const ctx = document.getElementById("applicationsChart");

new Chart(ctx, {
    type: "bar",
    data: {
        labels: [
            "New",
            "Reviewed",
            "Interview",
            "Hired"
        ],
        datasets: [{
            label: "Candidates",
            data: [12, 8, 5, 2],
            backgroundColor: [
                "#ff6600",
                "#00cfff",
                "#27ae60",
                "#f1c40f"
            ]
        }]
    },
    options: {
        responsive: true
    }
});