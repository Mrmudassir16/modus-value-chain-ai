let fullValueChainData = [];

document.addEventListener("DOMContentLoaded", () => {
    window.addEventListener("industryChanged", (e) => {
        loadValueChainData(e.detail.id);
    });

    // Handle drawer close button
    const closeBtn = document.getElementById("closeDrawerBtn");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeEvidenceDrawer);
    }

    // Handle search input filter
    const searchInput = document.getElementById("processSearch");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            filterProcesses(e.target.value.toLowerCase());
        });
    }
});

function loadValueChainData(industryId) {
    const lang = localStorage.getItem("modus_lang") || "en";
    fetch(`/api/value-chain/${industryId}?lang=${lang}`)
        .then(res => res.json())
        .then(data => {
            fullValueChainData = data.value_chain;
            renderStagesTimeline();
            if (fullValueChainData.length > 0) {
                selectStage(fullValueChainData[0].id);
            } else {
                document.getElementById("processesContainer").innerHTML = `
                    <div class="col-12 text-center text-muted py-5">
                        No stages configured for this industry. Add some in the Admin Panel.
                    </div>
                `;
            }
        })
        .catch(err => console.error("Error loading value chain:", err));
}

function renderStagesTimeline() {
    const container = document.getElementById("stagesTimelineContainer");
    if (!container) return;

    container.innerHTML = "";
    fullValueChainData.forEach((stage, idx) => {
        const step = document.createElement("div");
        step.className = "stage-step";
        step.id = `stageStep_${stage.id}`;
        step.onclick = () => selectStage(stage.id);

        step.innerHTML = `
            <div class="stage-num">${idx + 1}</div>
            <div class="fw-semibold text-truncate" style="max-width: 180px;">${stage.name}</div>
        `;
        container.appendChild(step);
    });
}

function selectStage(stageId) {
    document.querySelectorAll(".stage-step").forEach(el => {
        el.classList.remove("active");
    });
    const activeStep = document.getElementById(`stageStep_${stageId}`);
    if (activeStep) activeStep.classList.add("active");

    const selectedStage = fullValueChainData.find(s => s.id === stageId);
    if (!selectedStage) return;

    document.getElementById("stageTitleHeader").textContent = selectedStage.name;
    document.getElementById("stageDescHeader").textContent = selectedStage.description;

    renderProcesses(selectedStage.processes);
}

function renderProcesses(processes) {
    const container = document.getElementById("processesContainer");
    if (!container) return;

    container.innerHTML = "";
    if (processes.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-5">
                No business processes configured for this stage.
            </div>
        `;
        return;
    }

    processes.forEach(proc => {
        const col = document.createElement("div");
        col.className = "col-md-6 col-lg-4 mb-4 process-card-wrapper";
        col.dataset.name = proc.name.toLowerCase();
        col.dataset.desc = proc.description.toLowerCase();
        col.dataset.prob = proc.problem.toLowerCase();
        
        let oppHtml = "";
        if (proc.opportunity) {
            const opp = proc.opportunity;
            col.dataset.opp = opp.name.toLowerCase();
            
            // Classification badge class
            let badgeClass = "priority-medium";
            if (opp.priority_level === "Critical") badgeClass = "priority-high bg-danger text-light border-danger";
            else if (opp.priority_level === "High") badgeClass = "priority-high";
            else if (opp.priority_level === "Low") badgeClass = "priority-low";

            oppHtml = `
                <div class="mt-3 pt-3 border-top border-secondary-subtle">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="small fw-semibold text-secondary-emphasis">AI OPPORTUNITY</span>
                        <span class="badge-priority ${badgeClass}">${opp.priority_level} (Score: ${opp.priority_score})</span>
                    </div>
                    <h6 class="text-primary-emphasis mb-2 fw-semibold">${opp.name}</h6>
                    <p class="small text-secondary mb-3">${opp.description}</p>
                    
                    <div class="mb-2">
                        <span class="small fw-semibold d-block text-secondary-emphasis mb-1">TECH CAPABILITY</span>
                        <span class="badge-tag">${opp.capability}</span>
                    </div>

                    <div class="row mb-3">
                        <div class="col-6">
                            <span class="small fw-semibold d-block text-secondary-emphasis mb-1">BUSINESS VALUE (ROI)</span>
                            <span class="small text-info fw-bold"><i class="bi bi-graph-up-arrow"></i> Score: ${opp.roi || 5}/10</span>
                        </div>
                        <div class="col-6">
                            <span class="small fw-semibold d-block text-secondary-emphasis mb-1">CONFIDENCE</span>
                            <span class="small text-success fw-bold"><i class="bi bi-patch-check-fill"></i> ${opp.confidence_score}%</span>
                        </div>
                    </div>

                    <div class="mb-3">
                        <span class="small fw-semibold d-block text-secondary-emphasis mb-1">KEY BENEFIT</span>
                        <p class="small text-secondary mb-0">${opp.benefit}</p>
                    </div>

                    <div class="d-flex gap-2 mt-3">
                        <button class="btn btn-outline-info btn-sm rounded-pill flex-grow-1" onclick="openEvidenceDrawer(${opp.id}, '${opp.name}')">
                            <i class="bi bi-file-earmark-text"></i> Evidence
                        </button>
                        <button class="btn btn-primary btn-sm rounded-pill flex-grow-1" onclick="openExplainabilityModal(${proc.id})">
                            <i class="bi bi-patch-question"></i> Explain
                        </button>
                    </div>
                </div>
            `;
        } else {
            oppHtml = `
                <div class="mt-3 pt-3 border-top border-secondary-subtle text-center text-muted py-3 small">
                    No AI opportunity mapped yet.
                </div>
            `;
        }

        col.innerHTML = `
            <div class="glass-card h-100 d-flex flex-column justify-content-between">
                <div>
                    <h5 class="text-primary fw-semibold mb-2">${proc.name}</h5>
                    <p class="small text-secondary mb-3">${proc.description}</p>
                    
                    <div class="mb-2">
                        <span class="small fw-semibold d-block text-secondary-emphasis mb-1">BUSINESS PROBLEM</span>
                        <p class="small text-secondary-emphasis bg-black bg-opacity-25 p-2 rounded mb-0" style="border-left: 3px solid var(--accent-color);">${proc.problem}</p>
                    </div>
                </div>
                ${oppHtml}
            </div>
        `;
        container.appendChild(col);
    });
}

function filterProcesses(query) {
    document.querySelectorAll(".process-card-wrapper").forEach(card => {
        const name = card.dataset.name || "";
        const desc = card.dataset.desc || "";
        const prob = card.dataset.prob || "";
        const opp = card.dataset.opp || "";

        if (name.includes(query) || desc.includes(query) || prob.includes(query) || opp.includes(query)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

function openEvidenceDrawer(oppId, oppName) {
    const drawer = document.getElementById("evidenceDrawer");
    if (!drawer) return;

    document.getElementById("drawerOppName").textContent = oppName;
    const body = document.getElementById("drawerEvidenceBody");
    body.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-info" role="status"></div>
            <p class="small text-muted mt-2">Retrieving vector search research...</p>
        </div>
    `;

    drawer.classList.add("open");

    const industryId = localStorage.getItem("modus_industry_id") || "1";
    const lang = localStorage.getItem("modus_lang") || "en";
    
    fetch(`/api/opportunities/${oppId}/evidence?industry_id=${industryId}&lang=${lang}`)
        .then(res => res.json())
        .then(evidence => {
            body.innerHTML = "";
            if (evidence.length === 0) {
                body.innerHTML = `
                    <div class="text-center py-5 text-muted">
                        No matching evidence indexed in vector database. Upload research in Admin panel.
                    </div>
                `;
                return;
            }

            evidence.forEach(item => {
                const el = document.createElement("div");
                el.className = "evidence-item";
                el.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="small fw-semibold text-info">Match Score: ${Math.round(item.score * 100)}%</span>
                        <span class="badge bg-secondary small text-light">Trust: ${item.trust_score}%</span>
                    </div>
                    <h6 class="mb-1 text-primary-emphasis fw-bold">${item.title}</h6>
                    <p class="small text-secondary mb-2 italic">"${item.text}"</p>
                    <div class="small border-top border-secondary-subtle pt-2 mt-2">
                        <span class="d-block text-secondary"><strong>Author/Publisher:</strong> ${item.author} (${item.date_published || 'N/A'})</span>
                        <span class="d-block text-secondary"><strong>Citation:</strong> ${item.citation}</span>
                        ${item.url ? `<a href="${item.url}" target="_blank" class="text-accent small d-inline-block mt-1 fw-bold"><i class="bi bi-link-45deg"></i> Open Official Source URL</a>` : ""}
                    </div>
                `;
                body.appendChild(el);
            });
        })
        .catch(err => {
            console.error("Error fetching evidence:", err);
            body.innerHTML = `<div class="text-danger small py-3">Failed to load evidence: ${err.message}</div>`;
        });
}

function openExplainabilityModal(processId) {
    const modalEl = document.getElementById("explainModal");
    const body = document.getElementById("explainModalBody");
    if (!modalEl || !body) return;

    // Find process
    let selectedProc = null;
    fullValueChainData.forEach(stage => {
        const found = stage.processes.find(p => p.id === processId);
        if (found) selectedProc = found;
    });

    if (!selectedProc || !selectedProc.opportunity) return;

    const opp = selectedProc.opportunity;

    body.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="small text-muted mt-2">Compiling explainability report and research evidence...</p>
        </div>
    `;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    const industryId = localStorage.getItem("modus_industry_id") || "1";
    const lang = localStorage.getItem("modus_lang") || "en";

    // Fetch supporting research for evidence section
    fetch(`/api/opportunities/${opp.id}/evidence?industry_id=${industryId}&lang=${lang}`)
        .then(res => res.json())
        .then(evidence => {
            let evidenceHtml = "";
            if (evidence && evidence.length > 0) {
                evidence.forEach((ev, i) => {
                    evidenceHtml += `
                        <div class="p-3 bg-black bg-opacity-25 rounded border border-secondary border-opacity-15 mb-2">
                            <span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 mb-2">Evidence Source #${i + 1} (Score: ${Math.round(ev.score * 100)}%)</span>
                            <h6 class="fw-semibold text-primary-emphasis mb-1">${ev.title}</h6>
                            <p class="small text-secondary mb-2">"${ev.text}"</p>
                            <span class="d-block small text-muted font-monospace" style="font-size: 0.75rem;">Citation: ${ev.citation} | Trust Score: ${ev.trust_score}%</span>
                            ${ev.url ? `<a href="${ev.url}" target="_blank" class="small text-accent d-inline-block mt-2 fw-semibold"><i class="bi bi-box-arrow-up-right me-1"></i> Open Verification Document</a>` : ""}
                        </div>
                    `;
                });
            } else {
                evidenceHtml = `<p class="small text-muted mb-0">No active academic or legislative papers match this opportunity. Source is classified as Internal Architecture Synthesis.</p>`;
            }

            body.innerHTML = `
                <div class="row">
                    <div class="col-md-7 border-end border-secondary border-opacity-25">
                        <div class="mb-3">
                            <span class="small fw-semibold text-secondary d-block uppercase mb-1">BUSINESS PROBLEM</span>
                            <div class="p-2 rounded bg-black bg-opacity-25 border-start border-3 border-danger font-sans small text-light">${selectedProc.problem}</div>
                        </div>
                        <div class="mb-3">
                            <span class="small fw-semibold text-secondary d-block uppercase mb-1">AI SOLUTION OPPORTUNITY</span>
                            <h6 class="fw-bold text-primary mb-1">${opp.name}</h6>
                            <p class="small text-secondary m-0">${opp.description}</p>
                        </div>
                        <div class="mb-3">
                            <span class="small fw-semibold text-secondary d-block uppercase mb-1">WHY DEPLOY AI? (RATIONALE)</span>
                            <p class="small text-secondary m-0 bg-black bg-opacity-15 p-2 rounded">${opp.priority_rationale || 'High priority integration required to address manual speed boundaries and error rates.'}</p>
                        </div>
                        <div class="mb-3">
                            <span class="small fw-semibold text-secondary d-block uppercase mb-1">EXPECTED OPERATIONAL BENEFIT</span>
                            <p class="small text-secondary m-0 text-success fw-semibold"><i class="bi bi-arrow-up-right-circle me-1"></i> ${opp.benefit}</p>
                        </div>
                        <div class="mb-2">
                            <span class="small fw-semibold text-secondary d-block uppercase mb-1">RISK EXPOSURE & MITIGATION</span>
                            <p class="small text-secondary m-0 text-warning"><i class="bi bi-exclamation-triangle me-1"></i> ${opp.risk} (Severity: <strong>${opp.risk_severity}</strong>)</p>
                        </div>
                    </div>
                    <div class="col-md-5">
                        <div class="p-3 bg-black bg-opacity-25 rounded border border-secondary border-opacity-25 mb-3 text-center">
                            <span class="small fw-semibold text-secondary d-block uppercase mb-1">PRIORITY ASSESSMENT</span>
                            <span class="display-6 fw-bold text-info">${opp.priority_score}</span><span class="text-muted">/10</span>
                            <span class="d-block badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 w-50 mx-auto mt-2">${opp.priority_level} Priority</span>
                        </div>
                        <div class="p-3 bg-black bg-opacity-25 rounded border border-secondary border-opacity-25 mb-3 text-center">
                            <span class="small fw-semibold text-secondary d-block uppercase mb-1">AI CONFIDENCE ACCURACY</span>
                            <span class="display-6 fw-bold text-success">${opp.confidence_score}%</span>
                            <span class="d-block small text-muted mt-2">Calculated from Semantic Matches</span>
                        </div>
                        <div class="p-3 bg-black bg-opacity-25 rounded border border-secondary border-opacity-25 mb-0">
                            <span class="small fw-semibold text-secondary d-block uppercase mb-2">PRIORITY PARAMETERS</span>
                            <div class="row g-2 text-center text-secondary small">
                                <div class="col-4 border-end border-secondary border-opacity-20">
                                    <span class="d-block text-muted" style="font-size: 0.65rem;">ROI</span>
                                    <strong>${opp.roi || 5}/10</strong>
                                </div>
                                <div class="col-4 border-end border-secondary border-opacity-20">
                                    <span class="d-block text-muted" style="font-size: 0.65rem;">AP</span>
                                    <strong>${opp.automation_potential || 5}/10</strong>
                                </div>
                                <div class="col-4">
                                    <span class="d-block text-muted" style="font-size: 0.65rem;">Complexity</span>
                                    <strong>${opp.complexity || 5}/10</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="row mt-4 pt-3 border-top border-secondary border-opacity-20">
                    <div class="col-12">
                        <span class="small fw-semibold text-secondary d-block uppercase mb-2"><i class="bi bi-journal-check text-info me-1"></i>SUPPORTING RESEARCH EVIDENCE</span>
                        ${evidenceHtml}
                    </div>
                </div>
            `;
        })
        .catch(err => {
            console.error("Error loading report evidence:", err);
            body.innerHTML = `<div class="text-danger small py-3">Error fetching evidence: ${err.message}</div>`;
        });
}

function closeEvidenceDrawer() {
    const drawer = document.getElementById("evidenceDrawer");
    if (drawer) {
        drawer.classList.remove("open");
    }
}
