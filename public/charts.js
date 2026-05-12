window.updateRecruitmentChart = function(candidates) {

    const rejected =
        candidates.filter(c => c.status === "Rejected").length;

    const interview =
        candidates.filter(c => c.status === "Interview").length;

    const newCandidates =
        candidates.filter(c => c.status === "New").length;

    console.log("Analytics Updated", {
        newCandidates,
        interview,
        rejected
    });

};
