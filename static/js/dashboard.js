let riskChartInstance = null;
let heatmapChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    window.addEventListener("industryChanged", (e) => {
        loadDashboardData(e.detail.id);
    });
});

function loadDashboardData(industryId) {
    const lang = localStorage.getItem("modus_lang") || "en";
    fetch(`/api/industries/${industryId}/data?lang=${lang}`)
        .then(res => res.json())
        .then(data => {
            // 1. Update KPI numbers
            document.getElementById("kpiStages").textContent = data.stages_count;
            document.getElementById("kpiProcesses").textContent = data.processes_count;
            document.getElementById("kpiHighPri").textContent = data.high_priority_count;
            
            // Format Risk summary text
            const rSummary = data.risk_summary;
            const highCount = rSummary["High"] || 0;
            const medCount = rSummary["Medium"] || 0;
            const lowCount = rSummary["Low"] || 0;
            document.getElementById("kpiRisks").textContent = `${highCount} High / ${medCount} Med`;

            // Populate Expanded MODUS metrics
            document.getElementById("kpiHighestROI").textContent = data.highest_roi_process || "N/A";
            document.getElementById("kpiMostAutomatable").textContent = data.most_automatable_process || "N/A";
            document.getElementById("kpiConfidenceRisk").textContent = `${data.avg_confidence}% / ${data.avg_risk}`;
            document.getElementById("kpiReadinessCoverage").textContent = `${data.industry_readiness}% / ${data.research_coverage}%`;

            // 2. Render Risk Severity Chart
            renderRiskChart(lowCount, medCount, highCount);

            // 3. Render Priority Heatmap Chart
            renderHeatmapChart(data.heatmap);
        })
        .catch(err => console.error("Error loading dashboard details:", err));
}

function renderRiskChart(low, med, high) {
    const ctx = document.getElementById("riskDoughnutChart");
    if (!ctx) return;

    if (riskChartInstance) {
        riskChartInstance.destroy();
    }

    riskChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Low Risk', 'Medium Risk', 'High Risk'],
            datasets: [{
                data: [low, med, high],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.6)', // Emerald
                    'rgba(234, 179, 8, 0.6)',  // Amber
                    'rgba(249, 115, 22, 0.6)'   // Orange
                ],
                borderColor: [
                    '#10b981',
                    '#eab308',
                    '#f97316'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#6b7280'
                    }
                }
            }
        }
    });
}

function renderHeatmapChart(heatmapData) {
    const ctx = document.getElementById("priorityHeatmapChart");
    if (!ctx) return;

    if (heatmapChartInstance) {
        heatmapChartInstance.destroy();
    }

    const stages = heatmapData.map(item => item.stage_name);
    const scores = heatmapData.map(item => item.priority_score);

    const backgroundColors = heatmapData.map(item => {
        const s = item.priority_score;
        if (s >= 85) return 'rgba(239, 68, 68, 0.7)'; // Critical
        if (s >= 70) return 'rgba(249, 115, 22, 0.7)'; // High
        if (s >= 50) return 'rgba(234, 179, 8, 0.7)'; // Medium
        return 'rgba(16, 185, 129, 0.7)'; // Low
    });

    const borderColors = heatmapData.map(item => {
        const s = item.priority_score;
        if (s >= 85) return '#ef4444';
        if (s >= 70) return '#f97316';
        if (s >= 50) return '#eab308';
        return '#10b981';
    });

    heatmapChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: stages.map(s => s.length > 20 ? s.substring(0, 17) + '...' : s),
            datasets: [
                {
                    label: 'Stage Priority Score',
                    data: scores,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1.5,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#6b7280'
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#6b7280',
                        stepSize: 20
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#3b82f6',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const item = heatmapData[index];
                            if (!item) return "";
                            return [
                                `Priority Score: ${item.priority_score}/100`,
                                `Business Impact: ${item.business_impact}/10`,
                                `Automation Potential: ${item.automation_potential}/10`,
                                `Expected ROI: ${item.roi}/10`,
                                `Risk Score: ${item.risk}/10`,
                                `Confidence: ${item.confidence}%`,
                                `AI Opportunities: ${item.opportunities_count}`
                            ];
                        }
                    }
                }
            }
        }
    });
}
