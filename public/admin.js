document.addEventListener("DOMContentLoaded", () => {

    const applicationsContainer =
        document.getElementById("applications");

    const candidates = [
        { name: "John Smith", status: "New" },
        { name: "Sarah Johnson", status: "Interview" }
    ];

    function renderCandidates() {

        applicationsContainer.innerHTML = "";

        candidates.forEach((candidate, index) => {

            const card = document.createElement("div");

            card.style.padding = "20px";
            card.style.marginBottom = "15px";
            card.style.background = "#123456";
            card.style.color = "white";

            card.innerHTML = `
                <h3>${candidate.name}</h3>
                <p>Status: <strong>${candidate.status}</strong></p>

                <button onclick="rejectCandidate(${index})">
                    Reject Candidate
                </button>
            `;

            applicationsContainer.appendChild(card);

        });

    }

    window.rejectCandidate = function(index) {

        candidates[index].status = "Rejected";

        renderCandidates();

        if (window.updateRecruitmentChart) {
            window.updateRecruitmentChart(candidates);
        }

    };

    renderCandidates();

    if (window.updateRecruitmentChart) {
        window.updateRecruitmentChart(candidates);
    }

});
