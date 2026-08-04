import os
import uuid
import json
import logging
import csv
import io
import pypdf
from flask import Flask, request, jsonify, render_template, redirect, url_for

from config import DB_PATH, SUPPORTED_LANGUAGES
from database import init_db
from repositories import (
    IndustryRepository, StageRepository, ProcessRepository, 
    OpportunityRepository, ResearchRepository, SettingsRepository
)
from vector_store import index_research_source, delete_research_index, search_research
from ai_engine import query_ai_system
from services import PriorityEngine, ConfidenceEngine, TranslationService, AIAnalysisService

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = "modus_secret_key_change_me"

# Initialize database on startup
with app.app_context():
    init_db()

# Instantiate repositories and services
industry_repo = IndustryRepository()
stage_repo = StageRepository()
process_repo = ProcessRepository()
opp_repo = OpportunityRepository()
research_repo = ResearchRepository()
settings_repo = SettingsRepository()
translation_service = TranslationService()
ai_analysis_service = AIAnalysisService()

@app.context_processor
def inject_industries():
    try:
        return dict(industries_list=industry_repo.get_all())
    except Exception as e:
        logger.error(f"Error injecting industries list: {e}")
        return dict(industries_list=[])

# --- Helper for dynamic API translation ---
def translate_dict(data, target_lang):
    """
    Recursively translates string values in a dictionary/list structure.
    Uses TranslationService to fetch translations.
    """
    if target_lang == "en":
        return data
    
    if isinstance(data, dict):
        new_dict = {}
        for k, v in data.items():
            # Translate keys that usually store descriptions/names
            if k in ["name", "description", "problem", "benefit", "risk", "priority_rationale", "rationale", "technology", "capability", "title", "summary"]:
                if isinstance(v, str):
                    new_dict[k] = translation_service.translate(v, target_lang)
                else:
                    new_dict[k] = translate_dict(v, target_lang)
            else:
                new_dict[k] = translate_dict(v, target_lang)
        return new_dict
    elif isinstance(data, list):
        return [translate_dict(item, target_lang) for item in data]
    else:
        return data

# --- Page Routes ---
@app.route("/")
def index():
    return redirect(url_for("dashboard"))

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/value-chain")
def value_chain():
    return render_template("value_chain.html")

@app.route("/chat")
def chat():
    return render_template("chat.html")

@app.route("/admin")
def admin():
    return render_template("admin.html")

@app.route("/knowledge-base")
def knowledge_base():
    return render_template("knowledge_base.html")

@app.route("/architecture")
def architecture():
    return render_template("architecture.html")

# --- API Endpoints ---

@app.route("/api/industries", methods=["GET"])
def api_get_industries():
    try:
        lang = request.args.get("lang", "en")
        inds = industry_repo.get_all()
        return jsonify(translate_dict(inds, lang))
    except Exception as e:
        logger.error(f"API industries error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/industries/<int:id>/data", methods=["GET"])
def api_get_dashboard_data(id):
    try:
        lang = request.args.get("lang", "en")
        from database import get_dashboard_data
        data = get_dashboard_data(id)
        return jsonify(translate_dict(data, lang))
    except Exception as e:
        logger.error(f"API dashboard data error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/value-chain/<int:industry_id>", methods=["GET"])
def api_get_value_chain(industry_id):
    try:
        lang = request.args.get("lang", "en")
        from database import get_industry_details
        data = get_industry_details(industry_id)
        if not data:
            return jsonify({"error": "Industry not found"}), 404
        return jsonify(translate_dict(data, lang))
    except Exception as e:
        logger.error(f"API value chain error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/opportunities/<int:opp_id>/evidence", methods=["GET"])
def api_get_opportunity_evidence(opp_id):
    try:
        lang = request.args.get("lang", "en")
        industry_id = request.args.get("industry_id", type=int)
        if not industry_id:
            return jsonify({"error": "Missing industry_id parameter"}), 400
            
        opp = opp_repo.get_by_process(opp_id)
        if not opp:
            # Maybe query opp directly by ID
            with opp_repo.get_connection() as conn:
                opp_row = conn.execute("SELECT * FROM ai_opportunities WHERE id = ?;", (opp_id,)).fetchone()
                opp_desc = opp_row["description"] if opp_row else ""
        else:
            opp_desc = opp["description"]
            
        if not opp_desc:
            return jsonify({"error": "Opportunity not found"}), 404
            
        evidence = search_research(opp_desc, industry_id, top_k=3)
        return jsonify(translate_dict(evidence, lang))
    except Exception as e:
        logger.error(f"API opportunity evidence error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/research/<int:industry_id>", methods=["GET"])
def api_get_industry_research(industry_id):
    try:
        lang = request.args.get("lang", "en")
        rows = research_repo.get_by_industry(industry_id)
        return jsonify(translate_dict(rows, lang))
    except Exception as e:
        logger.error(f"API research error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/chat", methods=["POST"])
def api_post_chat():
    try:
        req_data = request.json or {}
        message = req_data.get("message")
        industry_id = req_data.get("industry_id")
        session_id = req_data.get("session_id")
        lang = req_data.get("lang", "en")
        
        if not message or not industry_id:
            return jsonify({"error": "Missing message or industry_id"}), 400
            
        if not session_id:
            session_id = str(uuid.uuid4())
            
        # Get chat history for session
        from repositories import ChatHistoryRepository
        chat_repo = ChatHistoryRepository()
        history_rows = chat_repo.get_session_history(session_id, industry_id=industry_id)
        
        # Execute AI reasoning & RAG lookup
        answer, reasoning, evidence = query_ai_system(message, industry_id, history_rows)
        
        evidence_str = json.dumps([{
            "title": e["title"],
            "url": e["url"],
            "citation": e["citation"],
            "score": e["score"]
        } for e in evidence])
        
        # Store in DB
        chat_repo.add_message(
            session_id=session_id,
            user_message=message,
            ai_response=f"{reasoning}\n---REASONING_END---\n{answer}" if reasoning else answer,
            reasoning_trace=reasoning,
            evidence_used=evidence_str,
            industry_id=industry_id
        )
        
        # Translate dynamic payload if required
        translated_answer = translation_service.translate(answer, lang)
        translated_reasoning = translation_service.translate(reasoning, lang)
        translated_evidence = translate_dict(evidence, lang)
        
        return jsonify({
            "session_id": session_id,
            "response": translated_answer,
            "reasoning": translated_reasoning,
            "evidence": translated_evidence
        })
    except Exception as e:
        logger.error(f"API chat error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/chat/history", methods=["GET"])
def api_get_chat_history():
    try:
        session_id = request.args.get("session_id")
        industry_id = request.args.get("industry_id", type=int)
        lang = request.args.get("lang", "en")
        if not session_id:
            return jsonify([])
            
        from repositories import ChatHistoryRepository
        chat_repo = ChatHistoryRepository()
        rows = chat_repo.get_session_history(session_id, industry_id=industry_id)
        
        history = []
        for r in rows:
            resp_raw = r["ai_response"]
            ans = resp_raw
            reasoning = r["reasoning_trace"] or ""
            if "---REASONING_END---" in resp_raw:
                parts = resp_raw.split("---REASONING_END---")
                ans = parts[1].strip()
                reasoning = parts[0].strip()
                
            evidence = []
            if r["evidence_used"]:
                try:
                    evidence = json.loads(r["evidence_used"])
                except:
                    pass
                    
            history.append({
                "id": r["id"],
                "user_message": r["user_message"],
                "ai_response": translation_service.translate(ans, lang),
                "reasoning_trace": translation_service.translate(reasoning, lang),
                "evidence_used": translate_dict(evidence, lang),
                "timestamp": r["timestamp"]
            })
        return jsonify(history)
    except Exception as e:
        logger.error(f"API chat history error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/settings", methods=["GET", "POST"])
def api_settings():
    if request.method == "POST":
        try:
            req_data = request.json or {}
            for k, v in req_data.items():
                settings_repo.save(k, v)
            return jsonify({"status": "success", "message": "Settings updated successfully"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        try:
            sets = settings_repo.get_all()
            return jsonify(sets)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

# --- Admin Operations (CRUD) ---

@app.route("/admin/industry", methods=["POST"])
def admin_add_industry():
    try:
        name = request.form.get("name")
        desc = request.form.get("description")
        if not name:
            return jsonify({"error": "Missing industry name"}), 400
            
        industry_repo.add(name, desc)
        return jsonify({"status": "success", "message": "Industry added successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/stage", methods=["POST"])
def admin_add_stage():
    try:
        industry_id = request.form.get("industry_id", type=int)
        name = request.form.get("name")
        desc = request.form.get("description")
        sequence = request.form.get("sequence", type=int, default=1)
        
        if not industry_id or not name:
            return jsonify({"error": "Missing parameters"}), 400
            
        stage_repo.add(industry_id, name, desc, sequence)
        return jsonify({"status": "success", "message": "Stage added successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/process", methods=["POST"])
def admin_add_process():
    try:
        stage_id = request.form.get("stage_id", type=int)
        name = request.form.get("name")
        desc = request.form.get("description")
        problem = request.form.get("problem")
        auto_analyze = request.form.get("auto_analyze") == "true"
        
        if not stage_id or not name or not problem:
            return jsonify({"error": "Missing stage, name, or problem parameters"}), 400
            
        process_id = process_repo.add(stage_id, name, desc)
        process_repo.add_problem(process_id, problem)

        if auto_analyze:
            # Trigger dynamic AI Analysis of the process and problem
            with stage_repo.get_connection() as conn:
                row = conn.execute(
                    """SELECT i.name as ind_name, s.name as stg_name FROM value_chain_stages s 
                       JOIN industries i ON s.industry_id = i.id WHERE s.id = ?;""",
                    (stage_id,)
                ).fetchone()
                ind_name = row["ind_name"] if row else "General Industry"
                stg_name = row["stg_name"] if row else "Value Chain Node"

            # Auto-generate AI Opportunity
            ai_data = ai_analysis_service.analyze_process(ind_name, stg_name, name, problem)
            
            opp_id = opp_repo.add(process_id, ai_data["opportunity_name"], ai_data["opportunity_description"], ai_data["confidence_score"])
            opp_repo.save_capability(opp_id, ai_data["technology"])
            opp_repo.save_benefit(opp_id, ai_data["benefit"])
            opp_repo.save_risk(opp_id, ai_data["risk"], ai_data["risk_severity"])
            
            # Compute Priority Score and Level via engine
            score = PriorityEngine.calculate_score(
                ai_data["automation_potential"], ai_data["business_impact"], ai_data["implementation_cost"],
                ai_data["complexity"], ai_data["risk_score"], ai_data["roi"]
            )
            level = PriorityEngine.classify_level(score)
            opp_repo.save_priority(
                opp_id, score, level, ai_data["rationale"],
                ai_data["automation_potential"], ai_data["business_impact"], ai_data["implementation_cost"],
                ai_data["complexity"], ai_data["risk_score"], ai_data["roi"]
            )

        return jsonify({"status": "success", "message": "Process added successfully!"})
    except Exception as e:
        logger.error(f"Error adding process: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/admin/opportunity", methods=["POST"])
def admin_add_opportunity():
    try:
        process_id = request.form.get("process_id", type=int)
        name = request.form.get("name")
        desc = request.form.get("description")
        tech = request.form.get("technology")
        benefit = request.form.get("benefit")
        risk = request.form.get("risk")
        risk_severity = request.form.get("risk_severity")
        
        # Read the priority inputs
        ap = request.form.get("automation_potential", type=int, default=5)
        bi = request.form.get("business_impact", type=int, default=5)
        ic = request.form.get("implementation_cost", type=int, default=5)
        cx = request.form.get("complexity", type=int, default=5)
        rs = request.form.get("risk_score", type=int, default=5)
        roi = request.form.get("roi", type=int, default=5)
        rationale = request.form.get("rationale", default="")
        
        # Calculate dynamic priority and classification
        priority_score = PriorityEngine.calculate_score(ap, bi, ic, cx, rs, roi)
        priority_level = PriorityEngine.classify_level(priority_score)

        # Confidence calculation
        confidence_score = ConfidenceEngine.calculate_score([0.8], [90], has_citations=False)

        if not process_id or not name or not desc or not tech or not benefit or not risk:
            return jsonify({"error": "Missing required fields"}), 400
            
        opp_id = opp_repo.add(process_id, name, desc, confidence_score)
        opp_repo.save_capability(opp_id, tech)
        opp_repo.save_benefit(opp_id, benefit)
        opp_repo.save_risk(opp_id, risk, risk_severity)
        opp_repo.save_priority(opp_id, priority_score, priority_level, rationale, ap, bi, ic, cx, rs, roi)
        
        return jsonify({"status": "success", "message": "AI Opportunity mapped and priority calculated successfully!"})
    except Exception as e:
        logger.error(f"Error adding opportunity: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/admin/research", methods=["POST"])
def admin_upload_research():
    try:
        industry_id = request.form.get("industry_id", type=int)
        title = request.form.get("title")
        url = request.form.get("url")
        citation = request.form.get("citation")
        summary = request.form.get("summary")
        content = request.form.get("content")
        author = request.form.get("author", default="Unknown")
        trust_score = request.form.get("trust_score", type=int, default=90)
        date_published = request.form.get("date_published")
        
        if not industry_id or not title or not citation:
            return jsonify({"error": "Missing industry, title, or citation fields"}), 400
            
        file = request.files.get("file")
        if file:
            filename = file.filename.lower()
            if filename.endswith(".pdf"):
                content = extract_text_from_pdf(file.stream)
            elif filename.endswith(".txt"):
                content = file.stream.read().decode("utf-8")
                
        if not content or not content.strip():
            return jsonify({"error": "Research document content is empty"}), 400
            
        if not summary:
            summary = content[:200] + "..."
            
        source_id = research_repo.add(industry_id, title, url, summary, content, author, trust_score, date_published)
        research_repo.add_citation(source_id, citation, author, url)
        
        # Index in ChromaDB
        index_research_source(
            source_id=source_id,
            industry_id=industry_id,
            title=title,
            url=url,
            citation=citation,
            text_content=content,
            author=author,
            trust_score=trust_score,
            date_published=date_published
        )
        
        return jsonify({"status": "success", "message": "Research source added and indexed in vector store successfully!"})
    except Exception as e:
        logger.error(f"Error uploading research: {e}")
        return jsonify({"error": str(e)}), 500

def extract_text_from_pdf(stream):
    try:
        reader = pypdf.PdfReader(stream)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
            text += "\n"
        return text
    except Exception as e:
        raise Exception(f"Failed to parse PDF: {str(e)}")

# --- Admin CSV Ingestion (Healthcare / Future Industries) ---
@app.route("/admin/industry/csv-upload", methods=["POST"])
def admin_csv_upload():
    try:
        name = request.form.get("name")
        desc = request.form.get("description")
        file = request.files.get("file")
        
        if not name or not file:
            return jsonify({"error": "Missing industry name or CSV file"}), 400
            
        # 1. Create Industry
        industry_id = industry_repo.add(name, desc)
        
        # 2. Parse CSV
        stream = io.StringIO(file.stream.read().decode("utf-8"), newline="")
        reader = csv.DictReader(stream)
        
        stages_cache = {}
        row_count = 0
        
        for row in reader:
            stage_name = row.get("Stage Name", "").strip()
            stage_desc = row.get("Stage Description", "").strip()
            process_name = row.get("Process Name", "").strip()
            process_desc = row.get("Process Description", "").strip()
            problem = row.get("Business Problem", "").strip()
            
            if not stage_name or not process_name:
                continue
                
            # Create Stage if new
            if stage_name not in stages_cache:
                seq = len(stages_cache) + 1
                stage_id = stage_repo.add(industry_id, stage_name, stage_desc, seq)
                stages_cache[stage_name] = stage_id
            else:
                stage_id = stages_cache[stage_name]
                
            # Create Process and Problem
            process_id = process_repo.add(stage_id, process_name, process_desc)
            process_repo.add_problem(process_id, problem)
            
            # Auto-generate AI analysis, capabilities, benefits, risk & computed priority
            ai_data = ai_analysis_service.analyze_process(name, stage_name, process_name, problem)
            
            opp_id = opp_repo.add(process_id, ai_data["opportunity_name"], ai_data["opportunity_description"], ai_data["confidence_score"])
            opp_repo.save_capability(opp_id, ai_data["technology"])
            opp_repo.save_benefit(opp_id, ai_data["benefit"])
            opp_repo.save_risk(opp_id, ai_data["risk"], ai_data["risk_severity"])
            
            score = PriorityEngine.calculate_score(
                ai_data["automation_potential"], ai_data["business_impact"], ai_data["implementation_cost"],
                ai_data["complexity"], ai_data["risk_score"], ai_data["roi"]
            )
            level = PriorityEngine.classify_level(score)
            opp_repo.save_priority(
                opp_id, score, level, ai_data["rationale"],
                ai_data["automation_potential"], ai_data["business_impact"], ai_data["implementation_cost"],
                ai_data["complexity"], ai_data["risk_score"], ai_data["roi"]
            )
            
            # Check for linked research source in CSV
            res_title = row.get("Research Document Title", "").strip()
            res_text = row.get("Research Document Text", "").strip()
            res_url = row.get("Research URL", "").strip()
            res_cit = row.get("Research Citation", "").strip()
            
            is_legal = "legal" in name.lower()
            if not is_legal:
                # Clean legal-specific URL fallbacks
                if not res_url or "nalsa.gov.in" in res_url or "ecourts.gov.in" in res_url:
                    res_url = "https://nha.gov.in" if "health" in name.lower() else "https://bis.org"
                if not res_cit:
                    res_cit = f"{name} Intelligence Map (2026)"
                
                # Replace legal terms in text and citation
                res_text = res_text.replace("High Court", "health authority" if "health" in name.lower() else "standards authority")
                res_text = res_text.replace("Supreme Court", "National Health Authority" if "health" in name.lower() else "standards board")
                res_text = res_text.replace("Bar Council", "Medical Council" if "health" in name.lower() else "standards committee")
                res_text = res_text.replace("Court", "health authority" if "health" in name.lower() else "standards authority")
                
                res_cit = res_cit.replace("High Court", "health authority" if "health" in name.lower() else "standards authority")
                res_cit = res_cit.replace("Supreme Court", "National Health Authority" if "health" in name.lower() else "standards board")
                res_cit = res_cit.replace("Bar Council", "Medical Council" if "health" in name.lower() else "standards committee")
                res_cit = res_cit.replace("Court", "health authority" if "health" in name.lower() else "standards authority")
            else:
                if not res_url:
                    res_url = "https://nalsa.gov.in"
                if not res_cit:
                    res_cit = f"{name} Intelligence Map (2026)"
            
            if res_title and res_text:
                source_id = research_repo.add(industry_id, res_title, res_url, res_text[:200] + "...", res_text, "RAG Indexer", 90, "2026-08-01")
                research_repo.add_citation(source_id, res_cit, "RAG Indexer", res_url)
                
                # Vector Search Indexing
                index_research_source(
                    source_id=source_id,
                    industry_id=industry_id,
                    title=res_title,
                    url=res_url,
                    citation=res_cit,
                    text_content=res_text,
                    author="RAG Indexer",
                    trust_score=90,
                    date_published="2026-08-01"
                )
                
            row_count += 1
            
        return jsonify({
            "status": "success", 
            "message": f"Successfully created industry '{name}' and ingested {row_count} processes with full RAG opportunities!"
        })
    except Exception as e:
        logger.error(f"Error ingesting CSV value chain: {e}")
        return jsonify({"error": str(e)}), 500

# --- Admin Edit / Delete Endpoints ---

@app.route("/admin/industry/edit", methods=["POST"])
def admin_edit_industry():
    try:
        industry_id = request.form.get("id", type=int)
        name = request.form.get("name")
        desc = request.form.get("description")
        if not industry_id or not name:
            return jsonify({"error": "Missing parameters"}), 400
        industry_repo.update(industry_id, name, desc)
        return jsonify({"status": "success", "message": "Industry updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/industry/delete", methods=["POST"])
def admin_delete_industry():
    try:
        industry_id = request.form.get("id", type=int)
        if not industry_id:
            return jsonify({"error": "Missing industry_id"}), 400
            
        # Delete references in ChromaDB first
        with research_repo.get_connection() as conn:
            rows = conn.execute("SELECT id FROM research_sources WHERE industry_id = ?;", (industry_id,)).fetchall()
            for r in rows:
                delete_research_index(r["id"])
                
        industry_repo.delete(industry_id)
        return jsonify({"status": "success", "message": "Industry deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/stage/edit", methods=["POST"])
def admin_edit_stage():
    try:
        stage_id = request.form.get("id", type=int)
        name = request.form.get("name")
        desc = request.form.get("description")
        sequence = request.form.get("sequence", type=int, default=1)
        if not stage_id or not name:
            return jsonify({"error": "Missing parameters"}), 400
        stage_repo.update(stage_id, name, desc, sequence)
        return jsonify({"status": "success", "message": "Stage updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/stage/delete", methods=["POST"])
def admin_delete_stage():
    try:
        stage_id = request.form.get("id", type=int)
        if not stage_id:
            return jsonify({"error": "Missing stage_id"}), 400
        stage_repo.delete(stage_id)
        return jsonify({"status": "success", "message": "Stage deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/process/edit", methods=["POST"])
def admin_edit_process():
    try:
        process_id = request.form.get("id", type=int)
        name = request.form.get("name")
        desc = request.form.get("description")
        problem = request.form.get("problem")
        if not process_id or not name or not problem:
            return jsonify({"error": "Missing parameters"}), 400
        process_repo.update(process_id, name, desc)
        process_repo.add_problem(process_id, problem)
        return jsonify({"status": "success", "message": "Process and problem updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/process/delete", methods=["POST"])
def admin_delete_process():
    try:
        process_id = request.form.get("id", type=int)
        if not process_id:
            return jsonify({"error": "Missing process_id"}), 400
        process_repo.delete(process_id)
        return jsonify({"status": "success", "message": "Process deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/opportunity/edit", methods=["POST"])
def admin_edit_opportunity():
    try:
        opp_id = request.form.get("id", type=int)
        name = request.form.get("name")
        desc = request.form.get("description")
        tech = request.form.get("technology")
        benefit = request.form.get("benefit")
        risk = request.form.get("risk")
        risk_severity = request.form.get("risk_severity")
        
        # Read the priority inputs
        ap = request.form.get("automation_potential", type=int, default=5)
        bi = request.form.get("business_impact", type=int, default=5)
        ic = request.form.get("implementation_cost", type=int, default=5)
        cx = request.form.get("complexity", type=int, default=5)
        rs = request.form.get("risk_score", type=int, default=5)
        roi = request.form.get("roi", type=int, default=5)
        rationale = request.form.get("rationale", default="")
        
        # Recompute priority parameters
        priority_score = PriorityEngine.calculate_score(ap, bi, ic, cx, rs, roi)
        priority_level = PriorityEngine.classify_level(priority_score)
        
        if not opp_id or not name or not desc or not tech or not benefit or not risk:
            return jsonify({"error": "Missing required fields"}), 400
            
        opp_repo.update(opp_id, name, desc)
        opp_repo.update_capability(opp_id, tech)
        opp_repo.update_benefit(opp_id, benefit)
        opp_repo.update_risk(opp_id, risk, risk_severity)
        opp_repo.save_priority(opp_id, priority_score, priority_level, rationale, ap, bi, ic, cx, rs, roi)
        
        return jsonify({"status": "success", "message": "AI Opportunity and priority updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/opportunity/delete", methods=["POST"])
def admin_delete_opportunity():
    try:
        opp_id = request.form.get("id", type=int)
        if not opp_id:
            return jsonify({"error": "Missing opportunity_id"}), 400
        opp_repo.delete(opp_id)
        return jsonify({"status": "success", "message": "AI Opportunity deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/research/delete", methods=["POST"])
def admin_delete_research():
    try:
        source_id = request.form.get("id", type=int)
        if not source_id:
            return jsonify({"error": "Missing research source id"}), 400
            
        delete_research_index(source_id)
        research_repo.delete(source_id)
        return jsonify({"status": "success", "message": "Research source deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
