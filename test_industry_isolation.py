import os
import sqlite3
import json
import unittest
import io
from app import app
import database
import vector_store
import ai_engine

class TestIndustryIsolation(unittest.TestCase):
    
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        
        # Ensure database is clean and loaded
        database.init_db()
        
        # Clean up database to ensure a clean state for the test industry
        conn = database.get_db_connection()
        conn.execute("DELETE FROM industries WHERE name = ?;", ("Healthcare Sector (Test)",))
        conn.execute("DELETE FROM chat_history WHERE session_id = ?;", ("shared_test_session_123",))
        conn.commit()
        conn.close()

    def test_dynamic_industry_isolation_and_legal_scrub(self):
        """Test database and API level isolation for multiple industries."""
        print("\n[ISOLATION TEST 1] Verifying industry data isolation...")
        
        # 1. Verify we can get industries
        res = self.app.get("/api/industries")
        self.assertEqual(res.status_code, 200)
        industries = json.loads(res.data)
        legal_ind = next(i for i in industries if "Legal" in i["name"])
        
        # 2. Upload Healthcare CSV to ingest a second industry
        csv_data = (
            "Stage Name,Stage Description,Process Name,Process Description,Business Problem,Research Document Title,Research Document Text,Research URL,Research Citation\n"
            "Cardio Care,Emergency room triaging and diagnostic routing.,Emergency Triaging,Sorting cardiovascular patients.,Manual sorting is slow.,Optimizing Cardiology Workflows,Automated cardiology checks save up to 40% waiting times in clinical care.,https://nalsa.gov.in,NHA Cardiology Studies (2025)\n"
        )
        
        res = self.app.post("/admin/industry/csv-upload", data={
            "name": "Healthcare Sector (Test)",
            "description": "Enterprise medical value chains",
            "file": (io.BytesIO(csv_data.encode("utf-8")), "healthcare.csv")
        })
        self.assertEqual(res.status_code, 200)
        
        # 3. Reload industries list and find Healthcare
        res = self.app.get("/api/industries")
        self.assertEqual(res.status_code, 200)
        industries = json.loads(res.data)
        health_ind = next(i for i in industries if i["name"] == "Healthcare Sector (Test)")
        
        # 4. Verify value chain is isolated for both industries
        res_legal = self.app.get(f"/api/value-chain/{legal_ind['id']}")
        self.assertEqual(res_legal.status_code, 200)
        data_legal = json.loads(res_legal.data)
        self.assertEqual(data_legal["industry"]["name"], "Indian Legal Services")
        
        res_health = self.app.get(f"/api/value-chain/{health_ind['id']}")
        self.assertEqual(res_health.status_code, 200)
        data_health = json.loads(res_health.data)
        self.assertEqual(data_health["industry"]["name"], "Healthcare Sector (Test)")
        self.assertEqual(data_health["value_chain"][0]["name"], "Cardio Care")
        
        # 5. Verify research repository only returns industry-specific research
        res_res_legal = self.app.get(f"/api/research/{legal_ind['id']}")
        sources_legal = json.loads(res_res_legal.data)
        self.assertTrue(all(src["industry_id"] == legal_ind["id"] for src in sources_legal))
        
        res_res_health = self.app.get(f"/api/research/{health_ind['id']}")
        sources_health = json.loads(res_res_health.data)
        self.assertTrue(all(src["industry_id"] == health_ind["id"] for src in sources_health))
        
        # 6. Verify that the legal-specific URLs and terms in Healthcare research sources were scrubbed during ingestion!
        for src in sources_health:
            # The URL https://nalsa.gov.in (Legal Aid) should have been scrubbed to healthcare equivalent
            self.assertNotIn("nalsa.gov.in", src["url"])
            self.assertIn("nha.gov.in", src["url"])
            
            # The content/citation must not have legal terms
            self.assertNotIn("Court", src["content"])
            self.assertNotIn("Bar Council", src["content"])
            self.assertNotIn("Supreme Court", src["content"])
            
        print("  - Value Chain and Research isolation and CSV scrubbing verified successfully.")

    def test_chat_session_isolation(self):
        """Test that chat histories are isolated by industry_id."""
        print("\n[ISOLATION TEST 2] Verifying chat session history isolation...")
        
        # Ingest Healthcare
        csv_data = (
            "Stage Name,Stage Description,Process Name,Process Description,Business Problem,Research Document Title,Research Document Text,Research URL,Research Citation\n"
            "Cardio Care,Onboarding.,Emergency Triaging,Sorting patients.,Slow.,Optimizing Cardiology Workflows,Cardiology checks.,https://nha.gov.in,Cardiology Report (2025)\n"
        )
        self.app.post("/admin/industry/csv-upload", data={
            "name": "Healthcare Sector (Test)",
            "description": "Enterprise medical value chains",
            "file": (io.BytesIO(csv_data.encode("utf-8")), "healthcare.csv")
        })
        
        res_inds = self.app.get("/api/industries")
        industries = json.loads(res_inds.data)
        legal_ind = next(i for i in industries if "Legal" in i["name"])
        health_ind = next(i for i in industries if i["name"] == "Healthcare Sector (Test)")
        
        session_id = "shared_test_session_123"
        
        # Post to Legal
        res_post_l = self.app.post("/api/chat", json={
            "message": "Which process has highest ROI?",
            "industry_id": legal_ind["id"],
            "session_id": session_id
        })
        self.assertEqual(res_post_l.status_code, 200)
        
        # Post to Healthcare
        res_post_h = self.app.post("/api/chat", json={
            "message": "Which process has highest ROI?",
            "industry_id": health_ind["id"],
            "session_id": session_id
        })
        self.assertEqual(res_post_h.status_code, 200)
        
        # Query history for Legal
        res_hist_l = self.app.get(f"/api/chat/history?session_id={session_id}&industry_id={legal_ind['id']}")
        hist_l = json.loads(res_hist_l.data)
        self.assertEqual(len(hist_l), 1)
        self.assertIn("Healthcare Sector (Test)" if "health" in legal_ind["name"].lower() else "Indian Legal Services", hist_l[0]["ai_response"])
        
        # Query history for Healthcare
        res_hist_h = self.app.get(f"/api/chat/history?session_id={session_id}&industry_id={health_ind['id']}")
        hist_h = json.loads(res_hist_h.data)
        self.assertEqual(len(hist_h), 1)
        self.assertIn("Healthcare Sector (Test)", hist_h[0]["ai_response"])
        
        print("  - Chat history records are correctly isolated by industry ID.")

    def test_offline_ai_response_legal_scrub(self):
        """Test that AI responses for Healthcare do not leak legal terms in reasoning or output."""
        print("\n[ISOLATION TEST 3] Verifying legal terms scrub in AI responses...")
        
        # Ingest Healthcare
        csv_data = (
            "Stage Name,Stage Description,Process Name,Process Description,Business Problem,Research Document Title,Research Document Text,Research URL,Research Citation\n"
            "Cardio Care,Onboarding.,Emergency Triaging,Sorting patients.,Slow.,Optimizing Cardiology Workflows,Cardiology checks.,https://nha.gov.in,Cardiology Report (2025)\n"
        )
        self.app.post("/admin/industry/csv-upload", data={
            "name": "Healthcare Sector (Test)",
            "description": "Enterprise medical value chains",
            "file": (io.BytesIO(csv_data.encode("utf-8")), "healthcare.csv")
        })
        
        res_inds = self.app.get("/api/industries")
        industries = json.loads(res_inds.data)
        health_ind = next(i for i in industries if i["name"] == "Healthcare Sector (Test)")
        
        # Trigger offline fallback by sending queries directly to query_ai_system / fallback
        ans, reasoning, evidence = ai_engine.query_ai_system("Which process has highest ROI?", health_ind["id"])
        
        full_response = ans + "\n" + reasoning
        self.assertNotIn("Supreme Court", full_response)
        self.assertNotIn("Bar Council", full_response)
        self.assertNotIn("Court", full_response)
        self.assertNotIn("Legal Research", full_response)
        self.assertIn("Healthcare Sector (Test)", full_response)
        
        print("  - Conversational AI outputs and reasoning traces are successfully scrubbed of legal references for non-legal industries.")

if __name__ == "__main__":
    unittest.main()
