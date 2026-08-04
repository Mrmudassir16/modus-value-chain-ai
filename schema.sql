-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- 1. Industries Table
CREATE TABLE IF NOT EXISTS industries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Value Chain Stages Table
CREATE TABLE IF NOT EXISTS value_chain_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    industry_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sequence INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE CASCADE
);

-- 3. Business Processes Table
CREATE TABLE IF NOT EXISTS business_processes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stage_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stage_id) REFERENCES value_chain_stages(id) ON DELETE CASCADE
);

-- 4. Business Problems Table
CREATE TABLE IF NOT EXISTS business_problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id INTEGER NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (process_id) REFERENCES business_processes(id) ON DELETE CASCADE
);

-- 5. AI Opportunities Table
CREATE TABLE IF NOT EXISTS ai_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    confidence_score REAL DEFAULT 85.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (process_id) REFERENCES business_processes(id) ON DELETE CASCADE
);

-- 6. AI Capabilities Table
CREATE TABLE IF NOT EXISTS ai_capabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL,
    technology TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (opportunity_id) REFERENCES ai_opportunities(id) ON DELETE CASCADE
);

-- 7. Business Benefits Table
CREATE TABLE IF NOT EXISTS benefits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL,
    benefit_desc TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (opportunity_id) REFERENCES ai_opportunities(id) ON DELETE CASCADE
);

-- 8. Risks Table
CREATE TABLE IF NOT EXISTS risks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL,
    risk_desc TEXT NOT NULL,
    severity TEXT CHECK(severity IN ('Low', 'Medium', 'High')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (opportunity_id) REFERENCES ai_opportunities(id) ON DELETE CASCADE
);

-- 9. Priorities Table
CREATE TABLE IF NOT EXISTS priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL UNIQUE,
    score REAL NOT NULL,
    priority_level TEXT CHECK(priority_level IN ('Low', 'Medium', 'High', 'Critical')) NOT NULL,
    rationale TEXT NOT NULL,
    automation_potential INTEGER DEFAULT 5,
    business_impact INTEGER DEFAULT 5,
    implementation_cost INTEGER DEFAULT 5,
    complexity INTEGER DEFAULT 5,
    risk_score INTEGER DEFAULT 5,
    roi INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (opportunity_id) REFERENCES ai_opportunities(id) ON DELETE CASCADE
);

-- 10. Research Sources Table
CREATE TABLE IF NOT EXISTS research_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    industry_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    summary TEXT,
    content TEXT NOT NULL,
    author TEXT DEFAULT 'Unknown',
    trust_score INTEGER DEFAULT 90,
    date_published TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE CASCADE
);

-- 11. Citations Table
CREATE TABLE IF NOT EXISTS citations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    research_source_id INTEGER NOT NULL,
    citation_string TEXT NOT NULL,
    authority TEXT NOT NULL,
    source_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (research_source_id) REFERENCES research_sources(id) ON DELETE CASCADE
);

-- 12. Chat History Table
CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    reasoning_trace TEXT,
    evidence_used TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    industry_id INTEGER,
    FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE CASCADE
);

-- 13. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('Admin', 'User')) DEFAULT 'User',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Analysis History Table
CREATE TABLE IF NOT EXISTS analysis_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    industry_id INTEGER NOT NULL,
    report_title TEXT NOT NULL,
    summary_findings TEXT,
    top_opportunities TEXT,
    risk_assessment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE CASCADE
);

-- 15. System Settings Table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- 16. Translation Cache Table
CREATE TABLE IF NOT EXISTS translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_text TEXT NOT NULL,
    target_lang TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    UNIQUE(original_text, target_lang)
);
