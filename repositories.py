import sqlite3
from config import DB_PATH

class BaseRepository:
    @staticmethod
    def get_connection():
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

class IndustryRepository(BaseRepository):
    def get_all(self):
        with self.get_connection() as conn:
            rows = conn.execute("SELECT * FROM industries ORDER BY name;").fetchall()
            return [dict(r) for r in rows]

    def get_by_id(self, industry_id):
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM industries WHERE id = ?;", (industry_id,)).fetchone()
            return dict(row) if row else None

    def add(self, name, description):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO industries (name, description) VALUES (?, ?);", (name, description))
            conn.commit()
            return cursor.lastrowid

    def update(self, industry_id, name, description):
        with self.get_connection() as conn:
            conn.execute("UPDATE industries SET name = ?, description = ? WHERE id = ?;", (name, description, industry_id))
            conn.commit()

    def delete(self, industry_id):
        with self.get_connection() as conn:
            conn.execute("DELETE FROM industries WHERE id = ?;", (industry_id,))
            conn.commit()

class StageRepository(BaseRepository):
    def get_by_industry(self, industry_id):
        with self.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM value_chain_stages WHERE industry_id = ? ORDER BY sequence;", 
                (industry_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    def add(self, industry_id, name, description, sequence):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO value_chain_stages (industry_id, name, description, sequence) VALUES (?, ?, ?, ?);",
                (industry_id, name, description, sequence)
            )
            conn.commit()
            return cursor.lastrowid

    def update(self, stage_id, name, description, sequence):
        with self.get_connection() as conn:
            conn.execute(
                "UPDATE value_chain_stages SET name = ?, description = ?, sequence = ? WHERE id = ?;",
                (name, description, sequence, stage_id)
            )
            conn.commit()

    def delete(self, stage_id):
        with self.get_connection() as conn:
            conn.execute("DELETE FROM value_chain_stages WHERE id = ?;", (stage_id,))
            conn.commit()

class ProcessRepository(BaseRepository):
    def get_by_stage(self, stage_id):
        with self.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM business_processes WHERE stage_id = ? ORDER BY name;",
                (stage_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    def add(self, stage_id, name, description):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO business_processes (stage_id, name, description) VALUES (?, ?, ?);",
                (stage_id, name, description)
            )
            conn.commit()
            return cursor.lastrowid

    def update(self, process_id, name, description):
        with self.get_connection() as conn:
            conn.execute(
                "UPDATE business_processes SET name = ?, description = ? WHERE id = ?;",
                (name, description, process_id)
            )
            conn.commit()

    def delete(self, process_id):
        with self.get_connection() as conn:
            conn.execute("DELETE FROM business_processes WHERE id = ?;", (process_id,))
            conn.commit()

    def get_problem(self, process_id):
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM business_problems WHERE process_id = ?;", (process_id,)).fetchone()
            return dict(row) if row else None

    def add_problem(self, process_id, description):
        with self.get_connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO business_problems (process_id, description) VALUES (?, ?);",
                (process_id, description)
            )
            conn.commit()

    def update_problem(self, process_id, description):
        with self.get_connection() as conn:
            conn.execute(
                "UPDATE business_problems SET description = ? WHERE process_id = ?;",
                (description, process_id)
            )
            conn.commit()

class OpportunityRepository(BaseRepository):
    def get_by_process(self, process_id):
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM ai_opportunities WHERE process_id = ?;", (process_id,)).fetchone()
            if not row:
                return None
            opp = dict(row)
            
            # Fetch capability, benefit, risk, and priority
            cap = conn.execute("SELECT * FROM ai_capabilities WHERE opportunity_id = ?;", (opp["id"],)).fetchone()
            opp["capability"] = cap["technology"] if cap else ""
            opp["capability_desc"] = cap["description"] if cap else ""

            ben = conn.execute("SELECT * FROM benefits WHERE opportunity_id = ?;", (opp["id"],)).fetchone()
            opp["benefit"] = ben["benefit_desc"] if ben else ""

            risk = conn.execute("SELECT * FROM risks WHERE opportunity_id = ?;", (opp["id"],)).fetchone()
            opp["risk"] = risk["risk_desc"] if risk else ""
            opp["risk_severity"] = risk["severity"] if risk else ""

            pri = conn.execute("SELECT * FROM priorities WHERE opportunity_id = ?;", (opp["id"],)).fetchone()
            if pri:
                opp["priority_score"] = pri["score"]
                opp["priority_level"] = pri["priority_level"]
                opp["priority_rationale"] = pri["rationale"]
                opp["automation_potential"] = pri["automation_potential"]
                opp["business_impact"] = pri["business_impact"]
                opp["implementation_cost"] = pri["implementation_cost"]
                opp["complexity"] = pri["complexity"]
                opp["risk_score"] = pri["risk_score"]
                opp["roi"] = pri["roi"]
            else:
                opp["priority_score"] = 5.0
                opp["priority_level"] = "Medium"
                opp["priority_rationale"] = ""
                opp["automation_potential"] = 5
                opp["business_impact"] = 5
                opp["implementation_cost"] = 5
                opp["complexity"] = 5
                opp["risk_score"] = 5
                opp["roi"] = 5
                
            return opp

    def add(self, process_id, name, description, confidence_score=85.0):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO ai_opportunities (process_id, name, description, confidence_score) VALUES (?, ?, ?, ?);",
                (process_id, name, description, confidence_score)
            )
            conn.commit()
            return cursor.lastrowid

    def update(self, opp_id, name, description, confidence_score=85.0):
        with self.get_connection() as conn:
            conn.execute(
                "UPDATE ai_opportunities SET name = ?, description = ?, confidence_score = ? WHERE id = ?;",
                (name, description, confidence_score, opp_id)
            )
            conn.commit()

    def delete(self, opp_id):
        with self.get_connection() as conn:
            conn.execute("DELETE FROM ai_opportunities WHERE id = ?;", (opp_id,))
            conn.commit()

    def save_capability(self, opp_id, technology, description=""):
        with self.get_connection() as conn:
            conn.execute(
                "INSERT INTO ai_capabilities (opportunity_id, technology, description) VALUES (?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET technology=excluded.technology, description=excluded.description;",
                (opp_id, technology, description)
            )
            conn.commit()

    def update_capability(self, opp_id, technology, description=""):
        with self.get_connection() as conn:
            conn.execute(
                "UPDATE ai_capabilities SET technology = ?, description = ? WHERE opportunity_id = ?;",
                (technology, description, opp_id)
            )
            conn.commit()

    def save_benefit(self, opp_id, benefit_desc):
        with self.get_connection() as conn:
            conn.execute(
                "INSERT INTO benefits (opportunity_id, benefit_desc) VALUES (?, ?) "
                "ON CONFLICT(id) DO UPDATE SET benefit_desc=excluded.benefit_desc;",
                (opp_id, benefit_desc)
            )
            conn.commit()

    def update_benefit(self, opp_id, benefit_desc):
        with self.get_connection() as conn:
            conn.execute(
                "UPDATE benefits SET benefit_desc = ? WHERE opportunity_id = ?;",
                (benefit_desc, opp_id)
            )
            conn.commit()

    def save_risk(self, opp_id, risk_desc, severity):
        with self.get_connection() as conn:
            conn.execute(
                "INSERT INTO risks (opportunity_id, risk_desc, severity) VALUES (?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET risk_desc=excluded.risk_desc, severity=excluded.severity;",
                (opp_id, risk_desc, severity)
            )
            conn.commit()

    def update_risk(self, opp_id, risk_desc, severity):
        with self.get_connection() as conn:
            conn.execute(
                "UPDATE risks SET risk_desc = ?, severity = ? WHERE opportunity_id = ?;",
                (risk_desc, severity, opp_id)
            )
            conn.commit()

    def save_priority(self, opp_id, score, priority_level, rationale,
                      automation_potential=5, business_impact=5, implementation_cost=5,
                      complexity=5, risk_score=5, roi=5):
        with self.get_connection() as conn:
            conn.execute(
                "INSERT INTO priorities (opportunity_id, score, priority_level, rationale, "
                "automation_potential, business_impact, implementation_cost, complexity, risk_score, roi) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(opportunity_id) DO UPDATE SET "
                "score=excluded.score, priority_level=excluded.priority_level, rationale=excluded.rationale, "
                "automation_potential=excluded.automation_potential, business_impact=excluded.business_impact, "
                "implementation_cost=excluded.implementation_cost, complexity=excluded.complexity, "
                "risk_score=excluded.risk_score, roi=excluded.roi;",
                (opp_id, score, priority_level, rationale,
                 automation_potential, business_impact, implementation_cost, complexity, risk_score, roi)
            )
            conn.commit()

class ResearchRepository(BaseRepository):
    def get_by_industry(self, industry_id):
        with self.get_connection() as conn:
            rows = conn.execute(
                """SELECT r.*, GROUP_CONCAT(c.citation_string, ', ') as citation
                   FROM research_sources r
                   LEFT JOIN citations c ON r.id = c.research_source_id
                   WHERE r.industry_id = ?
                   GROUP BY r.id;""",
                (industry_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    def add(self, industry_id, title, url, summary, content, author, trust_score, date_published):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO research_sources (industry_id, title, url, summary, content, author, trust_score, date_published) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
                (industry_id, title, url, summary, content, author, trust_score, date_published)
            )
            conn.commit()
            return cursor.lastrowid

    def delete(self, source_id):
        with self.get_connection() as conn:
            conn.execute("DELETE FROM research_sources WHERE id = ?;", (source_id,))
            conn.commit()

    def add_citation(self, research_source_id, citation_string, authority, source_url):
        with self.get_connection() as conn:
            conn.execute(
                "INSERT INTO citations (research_source_id, citation_string, authority, source_url) VALUES (?, ?, ?, ?);",
                (research_source_id, citation_string, authority, source_url)
            )
            conn.commit()

    def get_citations(self, research_source_id):
        with self.get_connection() as conn:
            rows = conn.execute("SELECT * FROM citations WHERE research_source_id = ?;", (research_source_id,)).fetchall()
            return [dict(r) for r in rows]

class ChatHistoryRepository(BaseRepository):
    def get_session_history(self, session_id, industry_id=None):
        with self.get_connection() as conn:
            if industry_id is not None:
                rows = conn.execute(
                    "SELECT * FROM chat_history WHERE session_id = ? AND industry_id = ? ORDER BY timestamp ASC;",
                    (session_id, int(industry_id))
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM chat_history WHERE session_id = ? ORDER BY timestamp ASC;",
                    (session_id,)
                ).fetchall()
            return [dict(r) for r in rows]

    def add_message(self, session_id, user_message, ai_response, reasoning_trace, evidence_used, industry_id=None):
        with self.get_connection() as conn:
            conn.execute(
                "INSERT INTO chat_history (session_id, user_message, ai_response, reasoning_trace, evidence_used, industry_id) "
                "VALUES (?, ?, ?, ?, ?, ?);",
                (session_id, user_message, ai_response, reasoning_trace, evidence_used, industry_id if industry_id is None else int(industry_id))
            )
            conn.commit()

class SettingsRepository(BaseRepository):
    def get_all(self):
        with self.get_connection() as conn:
            rows = conn.execute("SELECT * FROM settings;").fetchall()
            return {r["key"]: r["value"] for r in rows}

    def save(self, key, value):
        with self.get_connection() as conn:
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value;",
                (key, str(value))
            )
            conn.commit()

class TranslationRepository(BaseRepository):
    def get(self, original_text, target_lang):
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT translated_text FROM translations WHERE original_text = ? AND target_lang = ?;",
                (original_text, target_lang)
            ).fetchone()
            return row["translated_text"] if row else None

    def save(self, original_text, target_lang, translated_text):
        with self.get_connection() as conn:
            try:
                conn.execute(
                    "INSERT INTO translations (original_text, target_lang, translated_text) VALUES (?, ?, ?) "
                    "ON CONFLICT(original_text, target_lang) DO UPDATE SET translated_text=excluded.translated_text;",
                    (original_text, target_lang, translated_text)
                )
                conn.commit()
            except sqlite3.IntegrityError:
                pass
