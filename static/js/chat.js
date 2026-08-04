let chatSessionId = "";
let currentSessionEvidence = {}; // Temporarily map chunk references for citations
let lastLoadedIndustryId = null;

document.addEventListener("DOMContentLoaded", () => {
    window.addEventListener("industryChanged", (e) => {
        const industryId = e.detail.id;
        
        // Dynamically load suggested questions
        loadSuggestedQuestions(industryId);

        // Load chat session per industry
        chatSessionId = localStorage.getItem(`modus_chat_session_id_${industryId}`) || "";
        if (!chatSessionId) {
            chatSessionId = 'session_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem(`modus_chat_session_id_${industryId}`, chatSessionId);
        }
        
        loadChatHistory(industryId);
    });

    const chatForm = document.getElementById("chatForm");
    if (chatForm) {
        chatForm.addEventListener("submit", (e) => {
            e.preventDefault();
            sendChatMessage();
        });
    }

    const clearBtn = document.getElementById("clearChatBtn");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            const industryId = localStorage.getItem("modus_industry_id") || "1";
            chatSessionId = 'session_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem(`modus_chat_session_id_${industryId}`, chatSessionId);
            const messagesContainer = document.getElementById("chatMessages");
            if (messagesContainer) messagesContainer.innerHTML = "";
        });
    }

    // Initial load if STATE is already set
    if (typeof STATE !== "undefined" && STATE.selectedIndustryId) {
        const industryId = STATE.selectedIndustryId;
        loadSuggestedQuestions(industryId);
        chatSessionId = localStorage.getItem(`modus_chat_session_id_${industryId}`) || "";
        if (!chatSessionId) {
            chatSessionId = 'session_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem(`modus_chat_session_id_${industryId}`, chatSessionId);
        }
        loadChatHistory(industryId);
    }
});

function loadSuggestedQuestions(industryId) {
    if (lastLoadedIndustryId === industryId) return;
    lastLoadedIndustryId = industryId;

    const listContainer = document.getElementById("suggestedQuestionsList");
    if (!listContainer) return;

    listContainer.innerHTML = `
        <div class="text-center py-3 text-muted small">
            <div class="spinner-border spinner-border-sm text-secondary" role="status"></div>
            <span class="ms-1">Loading suggested questions...</span>
        </div>
    `;

    const lang = localStorage.getItem("modus_lang") || "en";
    fetch(`/api/value-chain/${industryId}?lang=${lang}`)
        .then(res => res.json())
        .then(data => {
            listContainer.innerHTML = "";
            const valueChain = data.value_chain || [];
            
            const questions = [
                "Which process has highest ROI?",
                "Which process has highest automation potential?",
                "Show high-risk opportunities.",
                "Show evidence.",
                "Compare two stages."
            ];

            if (valueChain.length > 0) {
                const stage = valueChain[0];
                const stageName = stage.name;
                
                let processName = "";
                for (let i = 0; i < valueChain.length; i++) {
                    if (valueChain[i].processes && valueChain[i].processes.length > 0) {
                        processName = valueChain[i].processes[0].name;
                        break;
                    }
                }

                if (processName) {
                    questions.push(`Explain ${processName}.`);
                    questions.push(`Which AI technology fits ${processName}?`);
                } else {
                    questions.push(`Explain ${stageName} stage.`);
                }
            }

            questions.forEach(q => {
                const btn = document.createElement("button");
                btn.className = "list-group-item list-group-item-action bg-transparent border-secondary text-secondary-emphasis small py-2 px-0";
                btn.onclick = () => setQuickQuery(q);
                btn.innerHTML = `<i class="bi bi-chevron-right text-info small me-1"></i> ${q}`;
                listContainer.appendChild(btn);
            });
        })
        .catch(err => {
            console.error("Error loading dynamic questions:", err);
            listContainer.innerHTML = `<div class="text-danger small py-2">Failed to load suggestions</div>`;
        });
}

function loadChatHistory(industryId) {
    const container = document.getElementById("chatMessages");
    if (!container) return;

    container.innerHTML = "";
    const lang = localStorage.getItem("modus_lang") || "en";
    fetch(`/api/chat/history?session_id=${chatSessionId}&industry_id=${industryId}&lang=${lang}`)
        .then(res => res.json())
        .then(history => {
            history.forEach(item => {
                // Add user message
                appendMessageBubble("user", item.user_message);
                
                // Keep track of source matches if any
                if (item.evidence_used) {
                    item.evidence_used.forEach((ev, idx) => {
                        currentSessionEvidence[`source_ref_${idx + 1}`] = ev;
                    });
                }
                
                // Add AI message with reasoning
                appendMessageBubble("ai", item.ai_response, item.reasoning_trace);
            });
            scrollToBottom();
        })
        .catch(err => console.error("Error loading chat history:", err));
}

function sendChatMessage() {
    const input = document.getElementById("chatInput");
    if (!input || !input.value.trim()) return;

    const message = input.value.trim();
    appendMessageBubble("user", message);
    input.value = "";
    scrollToBottom();

    // Show AI typing placeholder
    const typingBubble = appendTypingPlaceholder();
    scrollToBottom();

    const industryId = localStorage.getItem("modus_industry_id") || "1";

    fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: message,
            industry_id: parseInt(industryId),
            session_id: chatSessionId
        })
    })
    .then(res => res.json())
    .then(data => {
        // Remove typing placeholder
        typingBubble.remove();

        // Save evidence into temporary mapping for citation clicks
        if (data.evidence) {
            data.evidence.forEach((ev, idx) => {
                currentSessionEvidence[`source_ref_${idx + 1}`] = ev;
            });
        }

        appendMessageBubble("ai", data.response, data.reasoning);
        scrollToBottom();
    })
    .catch(err => {
        console.error("Error sending chat:", err);
        typingBubble.remove();
        appendMessageBubble("ai", "An error occurred while compiling AI response. Please make sure the backend is active.", "");
        scrollToBottom();
    });
}

function appendMessageBubble(sender, text, reasoning = "") {
    const container = document.getElementById("chatMessages");
    if (!container) return;

    const bubble = document.createElement("div");
    bubble.className = `chat-bubble bubble-${sender}`;

    if (sender === "user") {
        bubble.textContent = text;
    } else {
        // AI bubble can contain formatting + reasoning trace toggle
        let innerHtml = "";
        
        if (reasoning) {
            const rId = 'reasoning_' + Math.random().toString(36).substring(2, 9);
            innerHtml += `
                <div class="reasoning-toggle" onclick="toggleReasoning('${rId}')">
                    <i class="bi bi-cpu"></i> View Reasoning Path <i class="bi bi-chevron-down ms-1" id="icon_${rId}"></i>
                </div>
                <div class="reasoning-box d-none" id="${rId}">${reasoning}</div>
            `;
        }

        // Apply basic formatting parser (Markdown-ish & Citations)
        innerHtml += `<div class="ai-text-content">${parseResponseFormatting(text)}</div>`;
        bubble.innerHTML = innerHtml;
    }

    container.appendChild(bubble);
    return bubble;
}

function appendTypingPlaceholder() {
    const container = document.getElementById("chatMessages");
    if (!container) return null;

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble bubble-ai typing-placeholder";
    bubble.innerHTML = `
        <div class="spinner-grow spinner-grow-sm text-secondary" role="status"></div>
        <div class="spinner-grow spinner-grow-sm text-secondary" role="status"></div>
        <div class="spinner-grow spinner-grow-sm text-secondary" role="status"></div>
    `;
    container.appendChild(bubble);
    return bubble;
}

function toggleReasoning(boxId) {
    const box = document.getElementById(boxId);
    const icon = document.getElementById(`icon_${boxId}`);
    if (box) {
        box.classList.toggle("d-none");
        if (icon) {
            icon.classList.toggle("bi-chevron-down");
            icon.classList.toggle("bi-chevron-up");
        }
    }
}

function parseResponseFormatting(text) {
    if (!text) return "";
    
    // HTML Escape
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Replace Bold headers and lists
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Replace Markdown links
    escaped = escaped.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-info">$1</a>');

    // Parse Source ID citation numbers [Source ID 1] or similar
    escaped = escaped.replace(/\[Source ID (\d+)\]/g, (match, num) => {
        const key = `source_ref_${num}`;
        return `<span class="citation-ref" onclick="openCitationDrawer('${key}')">[Source ID ${num}]</span>`;
    });

    // Parse standard reference footnotes [1] or [2]
    escaped = escaped.replace(/\[(\d+)\]/g, (match, num) => {
        const key = `source_ref_${num}`;
        if (currentSessionEvidence[key]) {
            return `<span class="citation-ref" onclick="openCitationDrawer('${key}')">[${num}]</span>`;
        }
        return match;
    });

    return escaped.replace(/\n/g, "<br>");
}

function openCitationDrawer(evidenceKey) {
    const ev = currentSessionEvidence[evidenceKey];
    if (!ev) return;

    const drawer = document.getElementById("evidenceDrawer");
    if (!drawer) return;

    document.getElementById("drawerOppName").textContent = "Research Evidence Reference";
    const body = document.getElementById("drawerEvidenceBody");
    
    body.innerHTML = `
        <div class="evidence-item">
            <h6 class="mb-1 text-primary-emphasis">${ev.title}</h6>
            <p class="small text-secondary mb-2 italic">"${ev.text || ev.summary}"</p>
            <div class="small border-top border-secondary-subtle pt-2 mt-2">
                <span class="d-block text-secondary"><strong>Citation:</strong> ${ev.citation}</span>
                ${ev.url ? `<a href="${ev.url}" target="_blank" class="text-accent small d-inline-block mt-1"><i class="bi bi-link-45deg"></i> Source URL</a>` : ""}
                ${ev.score ? `<span class="d-block text-info mt-1">Match Confidence: ${Math.round(ev.score * 100)}%</span>` : ""}
            </div>
        </div>
    `;

    drawer.classList.add("open");
}

function scrollToBottom() {
    const container = document.getElementById("chatMessages");
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}
