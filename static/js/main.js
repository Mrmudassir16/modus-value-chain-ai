// Global state handling
const STATE = {
    selectedIndustryId: localStorage.getItem("modus_industry_id") || "1",
    selectedIndustryName: localStorage.getItem("modus_industry_name") || "Legal Services",
    theme: localStorage.getItem("modus_theme") || "dark",
    lang: localStorage.getItem("modus_lang") || "en"
};

// UI Translations Dictionary
const TRANSLATIONS = {
    en: {
        dashboard: "Dashboard",
        value_chain: "Value Chain",
        ai_assistant: "AI Assistant",
        knowledge_base: "Knowledge Base",
        architecture: "Architecture",
        admin_panel: "Admin Panel",
        active_industry: "Active Industry:",
        language: "Language:"
    },
    hi: {
        dashboard: "डैशबोर्ड",
        value_chain: "मूल्य श्रृंखला",
        ai_assistant: "एआई सहायक",
        knowledge_base: "ज्ञान भंडार",
        architecture: "आर्किटेक्चर",
        admin_panel: "प्रशासक पैनल",
        active_industry: "सक्रिय उद्योग:",
        language: "भाषा:"
    },
    te: {
        dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
        value_chain: "విలువ శృంఖల",
        ai_assistant: "AI సహాయకుడు",
        knowledge_base: "పరిశోధన రిపోజిటరీ",
        architecture: "ఆర్కిటెక్చర్",
        admin_panel: "నిర్వాహక ప్యానెల్",
        active_industry: "క్రియాశీల పరిశ్రమ:",
        language: "భాష:"
    },
    ta: {
        dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
        value_chain: "மதிப்பு சங்கிலಿ",
        ai_assistant: "AI உதவியாளர்",
        knowledge_base: "ஆராய்ச்சி களஞ்சியம்",
        architecture: "கட்டமைப்பு",
        admin_panel: "நிர்வாக குழு",
        active_industry: "செயலில் உள்ள துறை:",
        language: "மொழி:"
    },
    kn: {
        dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
        value_chain: "ಮೌಲ್ಯ ಸರಪಳಿ",
        ai_assistant: "ಎಐ ಸಹಾಯಕ",
        knowledge_base: "ಸಂಶೋಧನಾ ಭಂಡಾರ",
        architecture: "ರಚನೆ",
        admin_panel: "ನಿರ್ವಾಹಕ ಫಲಕ",
        active_industry: "ಸಕ್ರಿಯ ಉದ್ಯಮ:",
        language: "ಭಾಷೆ:"
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // 1. Apply active theme on load
    applyTheme(STATE.theme);
    
    const themeCheckbox = document.getElementById("themeCheckbox");
    if (themeCheckbox) {
        themeCheckbox.checked = STATE.theme === "light";
        themeCheckbox.addEventListener("change", (e) => {
            const newTheme = e.target.checked ? "light" : "dark";
            STATE.theme = newTheme;
            localStorage.setItem("modus_theme", newTheme);
            applyTheme(newTheme);
        });
    }

    // 2. Initialize Language Selector
    initLanguageSelector();

    // 3. Initialize Industry Selector in Header
    initIndustrySelector();
});

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
}

function initLanguageSelector() {
    const selector = document.getElementById("globalLanguageSelector");
    if (!selector) return;

    selector.value = STATE.lang;
    
    // Translate static strings initially
    translateUI(STATE.lang);

    selector.addEventListener("change", (e) => {
        STATE.lang = e.target.value;
        localStorage.setItem("modus_lang", STATE.lang);
        
        // Translate UI labels
        translateUI(STATE.lang);

        // Dispatch language change event so other pages fetch translated dynamic items
        window.dispatchEvent(new CustomEvent("languageChanged", {
            detail: { lang: STATE.lang }
        }));
        
        // Trigger industry change event as well to cause a page-level data reload
        window.dispatchEvent(new CustomEvent("industryChanged", {
            detail: {
                id: STATE.selectedIndustryId,
                name: STATE.selectedIndustryName
            }
        }));
    });
}

function translateUI(lang) {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    document.querySelectorAll(".trans-key").forEach(el => {
        const key = el.dataset.key;
        if (dict[key]) {
            el.textContent = dict[key];
        }
    });
}

function initIndustrySelector() {
    const selector = document.getElementById("globalIndustrySelector");
    if (!selector) return;

    fetch("/api/industries")
        .then(res => res.json())
        .then(industries => {
            selector.innerHTML = "";
            industries.forEach(ind => {
                const opt = document.createElement("option");
                opt.value = ind.id;
                opt.textContent = ind.name;
                if (String(ind.id) === String(STATE.selectedIndustryId)) {
                    opt.selected = true;
                    STATE.selectedIndustryName = ind.name;
                    localStorage.setItem("modus_industry_name", ind.name);
                }
                selector.appendChild(opt);
            });

            selector.addEventListener("change", (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                STATE.selectedIndustryId = e.target.value;
                STATE.selectedIndustryName = selectedOption.textContent;
                
                localStorage.setItem("modus_industry_id", STATE.selectedIndustryId);
                localStorage.setItem("modus_industry_name", STATE.selectedIndustryName);

                window.dispatchEvent(new CustomEvent("industryChanged", {
                    detail: {
                        id: STATE.selectedIndustryId,
                        name: STATE.selectedIndustryName
                    }
                }));
            });

            // Initial load
            window.dispatchEvent(new CustomEvent("industryChanged", {
                detail: {
                    id: STATE.selectedIndustryId,
                    name: STATE.selectedIndustryName
                }
            }));
        })
        .catch(err => console.error("Error loading industries:", err));
}
