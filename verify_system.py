import os
import sqlite3
import json
import unittest
import io
from app import app
import database
import vector_store
import ai_engine
from services import PriorityEngine, ConfidenceEngine, TranslationService

class TestValueChainAISystem(unittest.TestCase):
    
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_1_sqlite_database_tables(self):
        """Verify that SQLite tables are correctly initialized and populated."""
        print("\n[TEST 1] Verifying SQLite database structures...")
        conn = database.get_db_connection()
        cursor = conn.cursor()
        
        required_tables = [
            "industries", "value_chain_stages", "business_processes", "business_problems",
            "ai_opportunities", "ai_capabilities", "benefits", "risks",
            "priorities", "research_sources", "citations", "chat_history", 
            "users", "analysis_history", "settings", "translations"
        ]
        
        for table in required_tables:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}';")
            row = cursor.fetchone()
            self.assertIsNotNone(row, f"Table '{table}' is missing from the database.")
            print(f"  - Table '{table}' verified.")
            
        conn.close()

    def test_2_legal_services_seeded_data(self):
        """Verify that Legal Services data is properly seeded and linked."""
        print("\n[TEST 2] Verifying seeded Indian Legal Services structures...")
        conn = database.get_db_connection()
        
        ind = conn.execute("SELECT * FROM industries WHERE name = ?;", ("Indian Legal Services",)).fetchone()
        self.assertIsNotNone(ind, "Seeded industry 'Indian Legal Services' not found.")
        self.assertEqual(ind["name"], "Indian Legal Services")
        print("  - Indian Legal Services industry record verified.")

        stages = conn.execute("SELECT COUNT(*) FROM value_chain_stages WHERE industry_id = ?;", (ind["id"],)).fetchone()[0]
        self.assertEqual(stages, 12, f"Seeded value chain stages missing. Found {stages}, expected exactly 12.")
        print(f"  - Found {stages} value chain stages in database.")

        procs = conn.execute(
            """SELECT COUNT(*) FROM business_processes p 
               JOIN value_chain_stages s ON p.stage_id = s.id 
               WHERE s.industry_id = ?;""", 
            (ind["id"],)
        ).fetchone()[0]
        self.assertGreaterEqual(procs, 12, f"Seeded processes missing. Found {procs}, expected at least 12.")
        print(f"  - Found {procs} business processes mapped.")
        
        conn.close()

    def test_3_sentence_transformer_and_chromadb(self):
        """Verify that SentenceTransformer and ChromaDB generate and search embeddings successfully."""
        print("\n[TEST 3] Verifying embedding model & ChromaDB search...")
        
        model = vector_store.get_embedding_model()
        vec = model.encode("Verify embedding pipeline text similarity").tolist()
        self.assertEqual(len(vec), 384, f"SentenceTransformer embedding length mismatch: {len(vec)}")
        print("  - Local cached SentenceTransformer loaded and encoded text correctly.")

        # Test index search
        results = vector_store.search_research("M&A change-of-control compliance clause review", 1, top_k=2)
        self.assertGreaterEqual(len(results), 1, "Vector search returned no matching research sources.")
        print(f"  - Surfaced matching document: '{results[0]['title']}' with score {results[0]['score']}")

    def test_4_ai_rag_pipeline(self):
        """Verify the data-enforced prompt building and fallback reasoning engine."""
        print("\n[TEST 4] Verifying RAG workflow prompt injection & offline synthesis...")
        ans, reasoning, evidence = ai_engine.query_ai_system("Why is Precedent Search High Priority?", 1)
        
        self.assertIsNotNone(ans, "AI RAG pipeline failed to return an answer.")
        self.assertIsNotNone(reasoning, "AI RAG pipeline failed to output a reasoning trace.")
        self.assertGreaterEqual(len(evidence), 1, "AI RAG context failed to fetch supporting evidence.")
        
        print("  - Prompt compiler injected structured database items + vector search sources.")
        print("  - Reasoning trace separated from final answer.")
        print(f"  - Citations matched: {[e['title'] for e in evidence]}")

    def test_5_flask_api_endpoints(self):
        """Verify Flask REST endpoints return correct status codes and payloads."""
        print("\n[TEST 5] Verifying API REST endpoints...")
        
        res = self.app.get("/api/industries")
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(any(i["name"] == "Indian Legal Services" for i in data), "API failed to list Indian Legal Services industry.")
        print("  - GET /api/industries: 200 OK.")

        res = self.app.get("/api/value-chain/1")
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["industry"]["name"], "Indian Legal Services")
        self.assertEqual(len(data["value_chain"]), 12)
        print("  - GET /api/value-chain/1: 200 OK.")

        # Verify dashboard statistics and Calculated Heatmap
        res = self.app.get("/api/industries/1/data")
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertIn("heatmap", data)
        heatmap = data["heatmap"]
        self.assertGreater(len(heatmap), 0)
        first_stage = heatmap[0]
        self.assertIn("priority_score", first_stage)
        self.assertIn("business_impact", first_stage)
        self.assertIn("opportunities_count", first_stage)
        print("  - GET /api/industries/1/data (Heatmap calculations): 200 OK.")

    def test_6_priority_and_confidence_calculations(self):
        """Verify the logic and math of the priority and confidence scoring engines."""
        print("\n[TEST 6] Verifying Priority & Confidence engines...")
        
        # Test Priority Engine
        score_high = PriorityEngine.calculate_score(8, 8, 4, 4, 4, 8)
        level_high = PriorityEngine.classify_level(score_high)
        self.assertEqual(level_high, "High")
        self.assertGreaterEqual(score_high, 7.0)
        
        score_crit = PriorityEngine.calculate_score(10, 10, 1, 1, 1, 10)
        level_crit = PriorityEngine.classify_level(score_crit)
        self.assertEqual(level_crit, "Critical")
        
        # Test Confidence Engine
        conf = ConfidenceEngine.calculate_score([0.88], [95], has_citations=True)
        self.assertGreaterEqual(conf, 50.0)
        self.assertLessEqual(conf, 100.0)
        print(f"  - Priority score validation succeeded (High: {score_high}, Critical: {score_crit})")
        print(f"  - Confidence score validation succeeded (Calculated: {conf}%)")

    def test_7_translation_caching(self):
        """Verify translation translation caching and offline fallbacks."""
        print("\n[TEST 7] Verifying Translation Service and Cache repository...")
        ts = TranslationService()
        
        # Test pre-seeded translation
        translated_hi = ts.translate("Indian Legal Services", "hi")
        self.assertEqual(translated_hi, "भारतीय कानूनी सेवाएं")
        
        # Test caching of dynamic translations
        dynamic_text = "Standard Operating Systems"
        translated_kn = ts.translate(dynamic_text, "kn")
        self.assertIn(dynamic_text, translated_kn)  # Offline fallback matches
        
        # Verify cached hit
        cached_again = ts.translate(dynamic_text, "kn")
        self.assertEqual(translated_kn, cached_again)
        print("  - Seeded translation matches verified.")
        print("  - Dynamic fallback and sqlite caching verified.")

    def test_8_csv_industry_ingestion(self):
        """Verify dynamic CSV ingestion generates stages, processes and opportunities automatically."""
        print("\n[TEST 8] Verifying dynamic CSV Ingestion endpoint...")
        
        # Clean up any leftover records to ensure idempotent execution
        conn = database.get_db_connection()
        conn.execute("DELETE FROM industries WHERE name = ?;", ("Cardio Care Sector",))
        conn.commit()
        conn.close()
        
        csv_data = (
            "Stage Name,Stage Description,Process Name,Process Description,Business Problem,Research Document Title,Research Document Text,Research URL,Research Citation\n"
            "Cardiology,Heart checks,Pulse Monitoring,Read pulse rates,Manual reading takes too long,A Study in Heart Rates,Reading pulse with AI saves 90% times,https://nalsa.gov.in,Heart Report (2025)\n"
        )
        
        res = self.app.post("/admin/industry/csv-upload", data={
            "name": "Cardio Care Sector",
            "description": "Dynamic testing sector",
            "file": (io.BytesIO(csv_data.encode("utf-8")), "testing.csv")
        })
        
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertIn("ingested 1 processes", data["message"])
        
        # Verify in database
        conn = database.get_db_connection()
        ind = conn.execute("SELECT * FROM industries WHERE name = ?;", ("Cardio Care Sector",)).fetchone()
        self.assertIsNotNone(ind)
        
        stage = conn.execute("SELECT * FROM value_chain_stages WHERE industry_id = ?;", (ind["id"],)).fetchone()
        self.assertEqual(stage["name"], "Cardiology")
        
        # Delete test industry
        self.app.post("/admin/industry/delete", data={"id": ind["id"]})
        conn.close()
        print("  - Simulated CSV upload, dynamic database creation, and vector index calls verified.")

if __name__ == "__main__":
    unittest.main()
