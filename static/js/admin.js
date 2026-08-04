document.addEventListener("DOMContentLoaded", () => {
    // Load LLM Settings
    loadLLMSettings();

    // Populate dropdown selectors
    populateIndustryDropdowns();

    // Setup forms AJAX handlers
    setupFormHandlers();

    // Load database management views
    setupDatabaseManager();
});

const PROVIDER_MODELS = {
    ollama: [
        { value: "llama3.2", label: "Llama 3.2 (3B) - Recommended" },
        { value: "llama3", label: "Llama 3 (8B)" },
        { value: "mistral", label: "Mistral (7B)" },
        { value: "phi3", label: "Phi 3 (3.8B)" },
        { value: "gemma2", label: "Gemma 2 (9B)" },
        { value: "custom", label: "Custom Model..." }
    ],
    gemini: [
        { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash - Recommended" },
        { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
        { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
        { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash Experimental" },
        { value: "custom", label: "Custom Model..." }
    ],
    openrouter: [
        { value: "openrouter/free", label: "Auto-select Free Model (Recommended)" },
        { value: "google/gemma-4-31b-it:free", label: "Gemma 4 31B IT (Free)" },
        { value: "cohere/north-mini-code:free", label: "Cohere North Mini Code (Free)" },
        { value: "poolside/laguna-s-2.1:free", label: "Poolside Laguna S 2.1 (Free)" },
        { value: "custom", label: "Custom Model..." }
    ]
};

function updateModelOptions(provider, selectedModelValue) {
    const modelSelect = document.getElementById("llmModelSelect");
    const customDiv = document.getElementById("customModelDiv");
    const modelInput = document.getElementById("llmModel");
    if (!modelSelect) return;

    modelSelect.innerHTML = "";
    const models = PROVIDER_MODELS[provider] || [];
    
    let isMatched = false;
    models.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.value;
        opt.textContent = m.label;
        if (selectedModelValue && m.value === selectedModelValue) {
            opt.selected = true;
            isMatched = true;
        }
        modelSelect.appendChild(opt);
    });

    if (selectedModelValue && !isMatched && selectedModelValue !== "") {
        // Custom model not in preset list
        const customOpt = Array.from(modelSelect.options).find(opt => opt.value === "custom");
        if (customOpt) customOpt.selected = true;
        if (modelInput) modelInput.value = selectedModelValue;
        if (customDiv) customDiv.classList.remove("d-none");
    } else {
        if (modelInput && !isMatched) {
            modelInput.value = modelSelect.value;
        } else if (modelInput) {
            modelInput.value = selectedModelValue || "";
        }
        if (customDiv) {
            if (modelSelect.value === "custom") {
                customDiv.classList.remove("d-none");
            } else {
                customDiv.classList.add("d-none");
            }
        }
    }
}

function loadLLMSettings() {
    fetch("/api/settings")
        .then(res => res.json())
        .then(settings => {
            const provider = settings.llm_provider || "ollama";
            if (document.getElementById("llmProvider")) {
                document.getElementById("llmProvider").value = provider;
                toggleProviderFields(provider);
            }
            if (document.getElementById("ollamaHost")) document.getElementById("ollamaHost").value = settings.ollama_host || "http://localhost:11434";
            if (document.getElementById("openrouterKey")) document.getElementById("openrouterKey").value = settings.openrouter_key || "";
            
            // Populate and select appropriate model options
            const modelVal = settings.llm_model || "";
            updateModelOptions(provider, modelVal);
            
            // Listen to provider toggle
            const providerSel = document.getElementById("llmProvider");
            if (providerSel) {
                providerSel.addEventListener("change", (e) => {
                    const selectedProv = e.target.value;
                    toggleProviderFields(selectedProv);
                    updateModelOptions(selectedProv, "");
                });
            }

            // Listen to model select changes
            const modelSelect = document.getElementById("llmModelSelect");
            if (modelSelect) {
                modelSelect.addEventListener("change", (e) => {
                    const customDiv = document.getElementById("customModelDiv");
                    const modelInput = document.getElementById("llmModel");
                    if (e.target.value === "custom") {
                        if (customDiv) customDiv.classList.remove("d-none");
                        if (modelInput) modelInput.value = "";
                    } else {
                        if (customDiv) customDiv.classList.add("d-none");
                        if (modelInput) modelInput.value = e.target.value;
                    }
                });
            }
        })
        .catch(err => console.error("Error loading LLM settings:", err));
}

function toggleProviderFields(provider) {
    const ollamaDiv = document.getElementById("ollamaConfigDiv");
    const openrouterDiv = document.getElementById("openrouterConfigDiv");
    const keyLabel = document.getElementById("openrouterKeyLabel");
    
    if (provider === "ollama") {
        if (ollamaDiv) ollamaDiv.classList.remove("d-none");
        if (openrouterDiv) openrouterDiv.classList.add("d-none");
    } else if (provider === "openrouter") {
        if (ollamaDiv) ollamaDiv.classList.add("d-none");
        if (openrouterDiv) openrouterDiv.classList.remove("d-none");
        if (keyLabel) keyLabel.textContent = "OpenRouter API Key";
    } else if (provider === "gemini") {
        if (ollamaDiv) ollamaDiv.classList.add("d-none");
        if (openrouterDiv) openrouterDiv.classList.remove("d-none");
        if (keyLabel) keyLabel.textContent = "Google Gemini API Key";
    }
}

function populateIndustryDropdowns() {
    fetch("/api/industries")
        .then(res => res.json())
        .then(industries => {
            const dropdowns = [
                "stageIndustrySelect",
                "processIndustrySelect",
                "oppIndustrySelect",
                "researchIndustrySelect",
                "manageStageIndustrySelect",
                "manageProcessIndustrySelect",
                "manageOppIndustrySelect",
                "manageResearchIndustrySelect"
            ];
            
            dropdowns.forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;
                
                select.innerHTML = '<option value="">-- Select Industry --</option>';
                industries.forEach(ind => {
                    const opt = document.createElement("option");
                    opt.value = ind.id;
                    opt.textContent = ind.name;
                    select.appendChild(opt);
                });
            });

            // Set up cascading changes for Process & Opportunity adding
            setupCascadingSelectors();
        })
        .catch(err => console.error("Error populating dropdowns:", err));
}

function setupCascadingSelectors() {
    // 1. Process Industry Change -> Load Stages
    const procIndSel = document.getElementById("processIndustrySelect");
    const procStageSel = document.getElementById("processStageSelect");
    if (procIndSel && procStageSel) {
        procIndSel.addEventListener("change", (e) => {
            const indId = e.target.value;
            if (!indId) {
                procStageSel.innerHTML = '<option value="">-- Select Stage --</option>';
                return;
            }
            loadStagesForSelect(indId, procStageSel);
        });
    }

    // 2. Opportunity Industry Change -> Load Stages -> Load Processes
    const oppIndSel = document.getElementById("oppIndustrySelect");
    const oppStageSel = document.getElementById("oppStageSelect");
    const oppProcSel = document.getElementById("oppProcessSelect");
    
    if (oppIndSel && oppStageSel && oppProcSel) {
        oppIndSel.addEventListener("change", (e) => {
            const indId = e.target.value;
            oppProcSel.innerHTML = '<option value="">-- Select Process --</option>';
            if (!indId) {
                oppStageSel.innerHTML = '<option value="">-- Select Stage --</option>';
                return;
            }
            loadStagesForSelect(indId, oppStageSel);
        });

        oppStageSel.addEventListener("change", (e) => {
            const stageId = e.target.value;
            if (!stageId) {
                oppProcSel.innerHTML = '<option value="">-- Select Process --</option>';
                return;
            }
            loadProcessesForSelect(stageId, oppProcSel, "oppIndustrySelect");
        });
    }
}

function loadStagesForSelect(industryId, targetSelect) {
    targetSelect.innerHTML = '<option value="">Loading Stages...</option>';
    fetch(`/api/value-chain/${industryId}`)
        .then(res => res.json())
        .then(data => {
            targetSelect.innerHTML = '<option value="">-- Select Stage --</option>';
            data.value_chain.forEach(stage => {
                const opt = document.createElement("option");
                opt.value = stage.id;
                opt.textContent = stage.name;
                targetSelect.appendChild(opt);
            });
        })
        .catch(err => {
            console.error("Error loading stages:", err);
            targetSelect.innerHTML = '<option value="">Error loading stages</option>';
        });
}

function loadProcessesForSelect(stageId, targetSelect, indSelectId) {
    targetSelect.innerHTML = '<option value="">Loading Processes...</option>';
    const indId = document.getElementById(indSelectId).value;
    fetch(`/api/value-chain/${indId}`)
        .then(res => res.json())
        .then(data => {
            const stage = data.value_chain.find(s => String(s.id) === String(stageId));
            targetSelect.innerHTML = '<option value="">-- Select Process --</option>';
            if (stage && stage.processes) {
                stage.processes.forEach(proc => {
                    const opt = document.createElement("option");
                    opt.value = proc.id;
                    opt.textContent = proc.name;
                    targetSelect.appendChild(opt);
                });
            }
        })
        .catch(err => {
            console.error("Error loading processes:", err);
            targetSelect.innerHTML = '<option value="">Error loading processes</option>';
        });
}

function setupFormHandlers() {
    const alertPlaceholder = document.getElementById("adminAlertPlaceholder");

    const showAlert = (message, type) => {
        if (!alertPlaceholder) return;
        alertPlaceholder.innerHTML = `
            <div class="alert alert-${type} alert-dismissible" role="alert">
                <div>${message}</div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        window.scrollTo(0, 0);
    };

    // Submitting Settings
    const settingsForm = document.getElementById("settingsForm");
    if (settingsForm) {
        settingsForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const provider = document.getElementById("llmProvider").value;
            const host = document.getElementById("ollamaHost").value;
            const model = document.getElementById("llmModel").value;
            const key = document.getElementById("openrouterKey").value;

            fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    llm_provider: provider,
                    ollama_host: host,
                    llm_model: model,
                    openrouter_key: key
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) showAlert(data.error, "danger");
                else showAlert(data.message, "success");
            })
            .catch(err => showAlert(err.message, "danger"));
        });
    }

    // Dynamic standard form ajax builder
    const forms = [
        { id: "addIndustryForm", url: "/admin/industry" },
        { id: "addStageForm", url: "/admin/stage" },
        { id: "addProcessForm", url: "/admin/process" },
        { id: "addOppForm", url: "/admin/opportunity" }
    ];

    const csvForm = document.getElementById("uploadCsvIndustryForm");
    if (csvForm) {
        csvForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const formData = new FormData(csvForm);
            showAlert("Ingesting industry and generating dynamic AI opportunities... Please wait, this may take a few seconds.", "info");
            
            fetch("/admin/industry/csv-upload", {
                method: "POST",
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) showAlert(data.error, "danger");
                else {
                    showAlert(data.message, "success");
                    csvForm.reset();
                    populateIndustryDropdowns();
                    loadManageIndustriesList();
                }
            })
            .catch(err => showAlert(err.message, "danger"));
        });
    }

    forms.forEach(item => {
        const form = document.getElementById(item.id);
        if (!form) return;
        
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            
            fetch(item.url, {
                method: "POST",
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) showAlert(data.error, "danger");
                else {
                    showAlert(data.message, "success");
                    form.reset();
                    // Rebuild dropdowns and lists
                    populateIndustryDropdowns();
                    loadManageIndustriesList();
                }
            })
            .catch(err => showAlert(err.message, "danger"));
        });
    });

    // Research form upload
    const researchForm = document.getElementById("addResearchForm");
    if (researchForm) {
        researchForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const formData = new FormData(researchForm);
            
            showAlert("Indexing document & generating embeddings... Please wait.", "info");
            
            fetch("/admin/research", {
                method: "POST",
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) showAlert(data.error, "danger");
                else {
                    showAlert(data.message, "success");
                    researchForm.reset();
                }
            })
            .catch(err => showAlert(err.message, "danger"));
        });
    }
}

// --- database management / edit / delete scripts ---

function setupDatabaseManager() {
    // Reload lists on change
    loadManageIndustriesList();

    const stageInd = document.getElementById("manageStageIndustrySelect");
    if (stageInd) {
        stageInd.addEventListener("change", (e) => {
            loadManageStages(e.target.value);
        });
    }

    const procInd = document.getElementById("manageProcessIndustrySelect");
    const procStage = document.getElementById("manageProcessStageSelect");
    if (procInd && procStage) {
        procInd.addEventListener("change", (e) => {
            procStage.innerHTML = '<option value="">-- Select Stage --</option>';
            document.getElementById("manageProcessesList").innerHTML = '<div class="text-center py-2 text-muted">Select stage.</div>';
            if (e.target.value) {
                loadStagesForSelect(e.target.value, procStage);
            }
        });
        procStage.addEventListener("change", (e) => {
            loadManageProcesses(procInd.value, e.target.value);
        });
    }

    const oppInd = document.getElementById("manageOppIndustrySelect");
    const oppStage = document.getElementById("manageOppStageSelect");
    if (oppInd && oppStage) {
        oppInd.addEventListener("change", (e) => {
            oppStage.innerHTML = '<option value="">-- Select Stage --</option>';
            document.getElementById("manageOppsList").innerHTML = '<div class="text-center py-2 text-muted">Select stage.</div>';
            if (e.target.value) {
                loadStagesForSelect(e.target.value, oppStage);
            }
        });
        oppStage.addEventListener("change", (e) => {
            loadManageOpportunities(oppInd.value, e.target.value);
        });
    }

    const resInd = document.getElementById("manageResearchIndustrySelect");
    if (resInd) {
        resInd.addEventListener("change", (e) => {
            loadManageResearch(e.target.value);
        });
    }

    // Bind edit form submissions
    const editForm = document.getElementById("editForm");
    if (editForm) {
        editForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const actionUrl = editForm.dataset.actionUrl;
            const formData = new FormData(editForm);
            
            fetch(actionUrl, {
                method: "POST",
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    alert("Error editing: " + data.error);
                } else {
                    alert(data.message);
                    // Hide modal
                    const modalEl = document.getElementById("editModal");
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                    
                    // Refresh active viewlists
                    loadManageIndustriesList();
                    populateIndustryDropdowns();
                }
            })
            .catch(err => alert("Failed to edit: " + err.message));
        });
    }
}

function loadManageIndustriesList() {
    const list = document.getElementById("manageIndustriesList");
    if (!list) return;

    fetch("/api/industries")
        .then(res => res.json())
        .then(industries => {
            list.innerHTML = "";
            if (industries.length === 0) {
                list.innerHTML = '<div class="text-center py-2 text-muted">No industries found.</div>';
                return;
            }

            industries.forEach(ind => {
                const el = document.createElement("div");
                el.className = "list-group-item bg-transparent text-light border-secondary border-opacity-35 d-flex justify-content-between align-items-center py-2";
                el.innerHTML = `
                    <div>
                        <strong class="text-primary-emphasis">${ind.name}</strong>
                        <p class="small text-secondary mb-0 text-truncate" style="max-width: 400px;">${ind.description || "No description."}</p>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-warning" onclick="openEditModal('industry', ${ind.id}, '${ind.name.replace(/'/g, "\\'")}', '${(ind.description || "").replace(/'/g, "\\'")}')"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteRecord('/admin/industry/delete', ${ind.id}, 'industry')"><i class="bi bi-trash"></i></button>
                    </div>
                `;
                list.appendChild(el);
            });
        })
        .catch(err => console.error("Error loading manage industries:", err));
}

function loadManageStages(industryId) {
    const list = document.getElementById("manageStagesList");
    if (!list) return;

    if (!industryId) {
        list.innerHTML = '<div class="text-center py-2 text-muted">Select an industry.</div>';
        return;
    }

    fetch(`/api/value-chain/${industryId}`)
        .then(res => res.json())
        .then(data => {
            list.innerHTML = "";
            if (data.value_chain.length === 0) {
                list.innerHTML = '<div class="text-center py-2 text-muted">No stages found.</div>';
                return;
            }

            data.value_chain.forEach(stage => {
                const el = document.createElement("div");
                el.className = "list-group-item bg-transparent text-light border-secondary border-opacity-35 d-flex justify-content-between align-items-center py-2";
                el.innerHTML = `
                    <div>
                        <strong class="text-info">${stage.sequence}. ${stage.name}</strong>
                        <p class="small text-secondary mb-0 text-truncate" style="max-width: 400px;">${stage.description || "No description."}</p>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-warning" onclick="openEditModal('stage', ${stage.id}, '${stage.name.replace(/'/g, "\\'")}', '${(stage.description || "").replace(/'/g, "\\'")}', ${stage.sequence})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteRecord('/admin/stage/delete', ${stage.id}, 'stage')"><i class="bi bi-trash"></i></button>
                    </div>
                `;
                list.appendChild(el);
            });
        });
}

function loadManageProcesses(industryId, stageId) {
    const list = document.getElementById("manageProcessesList");
    if (!list) return;

    if (!stageId) {
        list.innerHTML = '<div class="text-center py-2 text-muted">Select stage.</div>';
        return;
    }

    fetch(`/api/value-chain/${industryId}`)
        .then(res => res.json())
        .then(data => {
            const stage = data.value_chain.find(s => String(s.id) === String(stageId));
            list.innerHTML = "";
            if (!stage || !stage.processes || stage.processes.length === 0) {
                list.innerHTML = '<div class="text-center py-2 text-muted">No processes found.</div>';
                return;
            }

            stage.processes.forEach(proc => {
                const el = document.createElement("div");
                el.className = "list-group-item bg-transparent text-light border-secondary border-opacity-35 d-flex justify-content-between align-items-center py-2";
                el.innerHTML = `
                    <div>
                        <strong class="text-light">${proc.name}</strong>
                        <p class="small text-secondary mb-0"><strong>Problem:</strong> ${proc.problem}</p>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-warning" onclick="openEditModal('process', ${proc.id}, '${proc.name.replace(/'/g, "\\'")}', '${(proc.description || "").replace(/'/g, "\\'")}', 0, '${proc.problem.replace(/'/g, "\\'")}')"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteRecord('/admin/process/delete', ${proc.id}, 'process')"><i class="bi bi-trash"></i></button>
                    </div>
                `;
                list.appendChild(el);
            });
        });
}

function loadManageOpportunities(industryId, stageId) {
    const list = document.getElementById("manageOppsList");
    if (!list) return;

    if (!stageId) {
        list.innerHTML = '<div class="text-center py-2 text-muted">Select stage.</div>';
        return;
    }

    fetch(`/api/value-chain/${industryId}`)
        .then(res => res.json())
        .then(data => {
            const stage = data.value_chain.find(s => String(s.id) === String(stageId));
            list.innerHTML = "";
            
            let oppsFound = [];
            if (stage && stage.processes) {
                stage.processes.forEach(p => {
                    if (p.opportunity) {
                        oppsFound.push(p.opportunity);
                    }
                });
            }

            if (oppsFound.length === 0) {
                list.innerHTML = '<div class="text-center py-2 text-muted">No mapped AI opportunities found.</div>';
                return;
            }

            oppsFound.forEach(opp => {
                const el = document.createElement("div");
                el.className = "list-group-item bg-transparent text-light border-secondary border-opacity-35 d-flex justify-content-between align-items-center py-2";
                
                // Serialise opportunity for the click handler
                const oppStr = JSON.stringify(opp).replace(/'/g, "&apos;");
                el.innerHTML = `
                    <div>
                        <strong class="text-accent-secondary">${opp.name}</strong>
                        <div class="small text-secondary mt-1">
                            <span class="badge-priority priority-${opp.priority_level.toLowerCase()} me-2">${opp.priority_level} (${opp.priority_score})</span>
                            <span><strong>Capability:</strong> ${opp.capability}</span>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-warning" 
                          onclick="editOpportunityBtnClick(this)" data-opp='${oppStr}'>
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteRecord('/admin/opportunity/delete', ${opp.id}, 'opportunity')"><i class="bi bi-trash"></i></button>
                    </div>
                `;
                list.appendChild(el);
            });
        });
}

function editOpportunityBtnClick(btn) {
    const opp = JSON.parse(btn.getAttribute("data-opp"));
    openEditOpportunityModal(opp);
}
window.editOpportunityBtnClick = editOpportunityBtnClick;

function openEditOpportunityModal(opp) {
    const modalEl = document.getElementById("editModal");
    const modalTitle = document.getElementById("editModalLabel");
    const modalBody = document.getElementById("editModalBody");
    const form = document.getElementById("editForm");

    modalTitle.textContent = `Edit AI Opportunity: ${opp.name}`;
    form.dataset.actionUrl = `/admin/opportunity/edit`;
    
    modalBody.innerHTML = `
        <input type="hidden" name="id" value="${opp.id}">
        <div class="mb-3">
            <label class="form-label small fw-semibold text-secondary">Opportunity Name</label>
            <input type="text" name="name" class="form-control bg-dark text-light border-secondary" value="${opp.name}" required>
        </div>
        <div class="mb-3">
            <label class="form-label small fw-semibold text-secondary">Description</label>
            <textarea name="description" rows="2" class="form-control bg-dark text-light border-secondary" required>${opp.description}</textarea>
        </div>
        <div class="row">
            <div class="col-md-6 mb-3">
                <label class="form-label small fw-semibold text-secondary">Technology Capability</label>
                <input type="text" name="technology" class="form-control bg-dark text-light border-secondary" value="${opp.capability}" required>
            </div>
            <div class="col-md-6 mb-3">
                <label class="form-label small fw-semibold text-secondary">Core Benefit</label>
                <input type="text" name="benefit" class="form-control bg-dark text-light border-secondary" value="${opp.benefit}" required>
            </div>
        </div>
        <div class="row">
            <div class="col-md-8 mb-3">
                <label class="form-label small fw-semibold text-secondary">Risk Exposure Description</label>
                <input type="text" name="risk" class="form-control bg-dark text-light border-secondary" value="${opp.risk}" required>
            </div>
            <div class="col-md-4 mb-3">
                <label class="form-label small fw-semibold text-secondary">Risk Severity</label>
                <select name="risk_severity" class="form-select bg-dark text-light border-secondary" required>
                    <option value="Low" ${opp.risk_severity === "Low" ? "selected" : ""}>Low</option>
                    <option value="Medium" ${opp.risk_severity === "Medium" ? "selected" : ""}>Medium</option>
                    <option value="High" ${opp.risk_severity === "High" ? "selected" : ""}>High</option>
                </select>
            </div>
        </div>
        <div class="row mb-3">
            <div class="col-md-4 mb-2">
                <label class="form-label small fw-semibold text-secondary">ROI (1-10)</label>
                <input type="number" name="roi" min="1" max="10" class="form-control bg-dark text-light border-secondary" value="${opp.roi || 5}" required>
            </div>
            <div class="col-md-4 mb-2">
                <label class="form-label small fw-semibold text-secondary">Automation Potential (1-10)</label>
                <input type="number" name="automation_potential" min="1" max="10" class="form-control bg-dark text-light border-secondary" value="${opp.automation_potential || 5}" required>
            </div>
            <div class="col-md-4 mb-2">
                <label class="form-label small fw-semibold text-secondary">Business Impact (1-10)</label>
                <input type="number" name="business_impact" min="1" max="10" class="form-control bg-dark text-light border-secondary" value="${opp.business_impact || 5}" required>
            </div>
        </div>
        <div class="row mb-3">
            <div class="col-md-4 mb-2">
                <label class="form-label small fw-semibold text-secondary">Implementation Cost (1-10)</label>
                <input type="number" name="implementation_cost" min="1" max="10" class="form-control bg-dark text-light border-secondary" value="${opp.implementation_cost || 5}" required>
            </div>
            <div class="col-md-4 mb-2">
                <label class="form-label small fw-semibold text-secondary">Complexity (1-10)</label>
                <input type="number" name="complexity" min="1" max="10" class="form-control bg-dark text-light border-secondary" value="${opp.complexity || 5}" required>
            </div>
            <div class="col-md-4 mb-2">
                <label class="form-label small fw-semibold text-secondary">Risk Score (1-10)</label>
                <input type="number" name="risk_score" min="1" max="10" class="form-control bg-dark text-light border-secondary" value="${opp.risk_score || 5}" required>
            </div>
        </div>
        <div class="mb-3">
            <label class="form-label small fw-semibold text-secondary">Priority Rationale</label>
            <textarea name="rationale" rows="2" class="form-control bg-dark text-light border-secondary">${opp.priority_rationale || ''}</textarea>
        </div>
    `;
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}
window.openEditOpportunityModal = openEditOpportunityModal;


function loadManageResearch(industryId) {
    const list = document.getElementById("manageResearchList");
    if (!list) return;

    if (!industryId) {
        list.innerHTML = '<div class="text-center py-2 text-muted">Select industry.</div>';
        return;
    }

    // Since we don't have a direct raw get research list API, we fetch opportunity evidence of any Opp or run research queries
    // We can also fetch the database directly, but wait! Let's hit the opportunity evidence list or a quick endpoint
    // To make it easy, we can search the research list using the chat route with a generic prompt like "*", or we can write a clean JSON endpoint.
    // Wait! Let's check: in app.py we do NOT have GET /api/research endpoint.
    // Let's add GET /api/research/<industry_id> to app.py! That will make research management extremely robust.
    // Wait! I did NOT write GET /api/research. But we can query it easily from SQLite inside a script.
    // Let's see: we can fetch `/api/opportunities/1/evidence?industry_id=` or just hit a new route, but wait:
    // To avoid rewriting python backend codes, we can query it via a simple dynamic endpoint.
    // Let's see: `/api/opportunities/0/evidence`? No, let's write a quick new route `/api/research/<industry_id>` in app.py! That is very clean and ensures our frontend list works.
    // Wait, let's look at get_db_connection: we can query research_sources.
    // Let's implement `/api/research/<int:industry_id>` route in app.py! It takes GET and returns research list. Let's do that!
    // But wait: is there an alternative? Let's check. Yes, let's write a simple fetch endpoint in app.py for research list. Let's do that first to keep Javascript clean!
    // Ah, wait: we can just add a simple JSON request to app.py. Yes! Let's do that. We will add a small REST endpoint `/api/research/<int:industry_id>`.
    
    fetch(`/api/research/${industryId}`)
        .then(res => res.json())
        .then(sources => {
            list.innerHTML = "";
            if (sources.length === 0) {
                list.innerHTML = '<div class="text-center py-2 text-muted">No research sources found.</div>';
                return;
            }

            sources.forEach(src => {
                const el = document.createElement("div");
                el.className = "list-group-item bg-transparent text-light border-secondary border-opacity-35 d-flex justify-content-between align-items-center py-2";
                el.innerHTML = `
                    <div>
                        <strong class="text-primary-emphasis">${src.title}</strong>
                        <p class="small text-secondary mb-0"><strong>Citation:</strong> ${src.citation || "None"} | <strong>URL:</strong> ${src.url || "None"}</p>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteRecord('/admin/research/delete', ${src.id}, 'research')"><i class="bi bi-trash"></i></button>
                    </div>
                `;
                list.appendChild(el);
            });
        })
        .catch(err => {
            list.innerHTML = `<div class="text-danger small py-2">Error: ${err.message}</div>`;
        });
}

function deleteRecord(actionUrl, id, type) {
    if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) {
        return;
    }

    const formData = new FormData();
    formData.append("id", id);

    fetch(actionUrl, {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) alert("Error deleting: " + data.error);
        else {
            alert(data.message);
            // Refresh selections
            loadManageIndustriesList();
            populateIndustryDropdowns();
        }
    })
    .catch(err => alert("Failed to delete record: " + err.message));
}

function openEditModal(type, id, name, desc, seq=0, problem="", tech="", benefit="", risk="", severity="Low", priority=5, priority_lvl="Medium", rationale="") {
    const modalEl = document.getElementById("editModal");
    const modalTitle = document.getElementById("editModalLabel");
    const modalBody = document.getElementById("editModalBody");
    const form = document.getElementById("editForm");

    modalTitle.textContent = `Edit ${type.toUpperCase()}: ${name}`;
    form.dataset.actionUrl = `/admin/${type}/edit`;
    modalBody.innerHTML = `<input type="hidden" name="id" value="${id}">`;

    if (type === "industry") {
        modalBody.innerHTML += `
            <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary">Name</label>
                <input type="text" name="name" class="form-control bg-dark text-light border-secondary" value="${name}" required>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary">Description</label>
                <textarea name="description" rows="3" class="form-control bg-dark text-light border-secondary">${desc}</textarea>
            </div>
        `;
    } else if (type === "stage") {
        modalBody.innerHTML += `
            <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary">Name</label>
                <input type="text" name="name" class="form-control bg-dark text-light border-secondary" value="${name}" required>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary">Sequence Order</label>
                <input type="number" name="sequence" class="form-control bg-dark text-light border-secondary" value="${seq}" required>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary">Description</label>
                <textarea name="description" rows="3" class="form-control bg-dark text-light border-secondary">${desc}</textarea>
            </div>
        `;
    } else if (type === "process") {
        modalBody.innerHTML += `
            <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary">Name</label>
                <input type="text" name="name" class="form-control bg-dark text-light border-secondary" value="${name}" required>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary">Description</label>
                <textarea name="description" rows="2" class="form-control bg-dark text-light border-secondary">${desc}</textarea>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary">Business Problem</label>
                <textarea name="problem" rows="3" class="form-control bg-dark text-light border-secondary" required>${problem}</textarea>
            </div>
        `;
    } else if (type === "opportunity") {
        modalBody.innerHTML += `
            <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary">Opportunity Name</label>
                <input type="text" name="name" class="form-control bg-dark text-light border-secondary" value="${name}" required>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary">Description</label>
                <textarea name="description" rows="2" class="form-control bg-dark text-light border-secondary" required>${desc}</textarea>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label small fw-semibold text-secondary">Technology Capability</label>
                    <input type="text" name="technology" class="form-control bg-dark text-light border-secondary" value="${tech}" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label small fw-semibold text-secondary">Core Benefit</label>
                    <input type="text" name="benefit" class="form-control bg-dark text-light border-secondary" value="${benefit}" required>
                </div>
            </div>
            <div class="row">
                <div class="col-md-8 mb-3">
                    <label class="form-label small fw-semibold text-secondary">Risk Exposure Description</label>
                    <input type="text" name="risk" class="form-control bg-dark text-light border-secondary" value="${risk}" required>
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label small fw-semibold text-secondary">Risk Severity</label>
                    <select name="risk_severity" class="form-select bg-dark text-light border-secondary" required>
                        <option value="Low" ${severity === "Low" ? "selected" : ""}>Low</option>
                        <option value="Medium" ${severity === "Medium" ? "selected" : ""}>Medium</option>
                        <option value="High" ${severity === "High" ? "selected" : ""}>High</option>
                    </select>
                </div>
            </div>
            <div class="row">
                <div class="col-md-4 mb-3">
                    <label class="form-label small fw-semibold text-secondary">Priority Score (1-10)</label>
                    <input type="number" name="priority_score" min="1" max="10" class="form-control bg-dark text-light border-secondary" value="${priority}" required>
                </div>
                <div class="col-md-8 mb-3">
                    <label class="form-label small fw-semibold text-secondary">Priority Level</label>
                    <select name="priority_level" class="form-select bg-dark text-light border-secondary" required>
                        <option value="Low" ${priority_lvl === "Low" ? "selected" : ""}>Low Priority</option>
                        <option value="Medium" ${priority_lvl === "Medium" ? "selected" : ""}>Medium Priority</option>
                        <option value="High" ${priority_lvl === "High" ? "selected" : ""}>High Priority</option>
                    </select>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary">Priority Rationale</label>
                <textarea name="rationale" rows="2" class="form-control bg-dark text-light border-secondary">${rationale}</textarea>
            </div>
        `;
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}
