# System sqlite3 override for ChromaDB compatibility on Linux deployment environments (e.g. Render)
try:
    __import__('pysqlite3')
    import sys
    sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
except ImportError:
    pass

import os
import chromadb
from config import CHROMA_PATH, DB_PATH

class VectorWrapper:
    def __init__(self, vector):
        self.vector = vector
    def tolist(self):
        return self.vector

class GeminiEmbeddingWrapper:
    def __init__(self, api_key):
        self.api_key = api_key

    def encode(self, text):
        import requests
        headers = {"Content-Type": "application/json"}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={self.api_key}"
        
        if isinstance(text, str):
            payload = {
                "model": "models/text-embedding-004",
                "content": {
                    "parts": [{"text": text}]
                }
            }
            try:
                r = requests.post(url, headers=headers, json=payload, timeout=15)
                if r.status_code == 200:
                    res = r.json()
                    vector = res["embedding"]["values"]
                    return VectorWrapper(vector)
            except Exception as e:
                print(f"Error calling Gemini Embedding API: {e}")
            # Fallback to dummy vector if API call fails
            return VectorWrapper([0.0] * 768)
        else:
            # Batch encode
            results = []
            for t in text:
                results.append(self.encode(t))
            return results

# Lazy load model to speed up startup time in scripts
_model = None

def get_embedding_model():
    global _model
    if _model is not None:
        return _model

    # Check for Gemini API key to use external API embeddings and save memory
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        try:
            from database import get_settings
            settings = get_settings()
            api_key = settings.get("gemini_key", "")
        except Exception:
            pass
            
    if api_key:
        print("Using Gemini API text-embedding-004 for vector search (memory-optimized).")
        _model = GeminiEmbeddingWrapper(api_key)
        return _model

    # Fallback to local sentence-transformers
    print("No Gemini API key found. Falling back to local SentenceTransformer...")
    try:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    except ImportError:
        print("sentence-transformers not installed. Using dummy hash-based embedding fallback.")
        # Dummy fallback encoder to prevent crash
        class DummyEmbeddingWrapper:
            def encode(self, text):
                import hashlib
                if isinstance(text, str):
                    # generate a deterministic mock vector of size 384
                    hash_val = hashlib.sha256(text.encode('utf-8')).digest()
                    vector = []
                    for i in range(384):
                        val = (hash_val[i % len(hash_val)] / 255.0) - 0.5
                        vector.append(val)
                    return VectorWrapper(vector)
                else:
                    return [self.encode(t) for t in text]
        _model = DummyEmbeddingWrapper()
        
    return _model

def get_chroma_client():
    os.makedirs(CHROMA_PATH, exist_ok=True)
    return chromadb.PersistentClient(path=CHROMA_PATH)

def get_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(name="modus_research")

def split_text_into_chunks(text, chunk_size=800):
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    chunks = []
    current_chunk = ""
    for para in paragraphs:
        if len(para) > chunk_size:
            sentences = para.replace('. ', '.\n').split('\n')
            for sentence in sentences:
                sentence = sentence.strip()
                if not sentence:
                    continue
                if len(current_chunk) + len(sentence) <= chunk_size:
                    current_chunk += " " + sentence if current_chunk else sentence
                else:
                    if current_chunk:
                        chunks.append(current_chunk)
                    current_chunk = sentence
        else:
            if len(current_chunk) + len(para) <= chunk_size:
                current_chunk += "\n" + para if current_chunk else para
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = para
    if current_chunk:
        chunks.append(current_chunk)
    return chunks

def index_research_source(source_id, industry_id, title, url, citation, text_content, author="Unknown", trust_score=90, date_published=""):
    collection = get_collection()
    model = get_embedding_model()
    
    chunks = split_text_into_chunks(text_content)
    if not chunks:
        return
        
    documents = []
    metadatas = []
    ids = []
    embeddings = []
    
    for idx, chunk in enumerate(chunks):
        chunk_id = f"source_{source_id}_chunk_{idx}"
        documents.append(chunk)
        metadatas.append({
            "source_id": int(source_id),
            "industry_id": int(industry_id),
            "title": str(title),
            "url": str(url or ""),
            "citation": str(citation),
            "author": str(author),
            "trust_score": int(trust_score),
            "date_published": str(date_published or "")
        })
        ids.append(chunk_id)
        vector = model.encode(chunk).tolist()
        embeddings.append(vector)
        
    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas
    )

def delete_research_index(source_id):
    collection = get_collection()
    collection.delete(where={"source_id": int(source_id)})

def search_research(query, industry_id, top_k=3):
    collection = get_collection()
    model = get_embedding_model()
    
    query_vector = model.encode(query).tolist()
    
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=top_k,
        where={"industry_id": int(industry_id)}
    )
    
    retrieved_items = []
    if not results or not results['documents'] or len(results['documents'][0]) == 0:
        return retrieved_items
        
    docs = results['documents'][0]
    metas = results['metadatas'][0]
    distances = results['distances'][0] if 'distances' in results and results['distances'] else [0] * len(docs)
    ids = results['ids'][0]
    
    for i in range(len(docs)):
        score = round(1 - distances[i], 4) if distances[i] is not None else 0.5
        retrieved_items.append({
            "id": ids[i],
            "text": docs[i],
            "source_id": metas[i].get("source_id"),
            "title": metas[i].get("title"),
            "url": metas[i].get("url"),
            "citation": metas[i].get("citation"),
            "author": metas[i].get("author", "Unknown"),
            "trust_score": metas[i].get("trust_score", 90),
            "date_published": metas[i].get("date_published", ""),
            "score": score
        })
    return retrieved_items

def seed_vector_store():
    import sqlite3
    if not os.path.exists(DB_PATH):
        return
        
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    collection = get_collection()
    count = len(collection.get(limit=1)['ids'])
    if count > 0:
        # If schema upgraded, let's clear the old collection first
        print("Upgrading vector store: clearing and rebuilding index...")
        # Get count or list and delete
        try:
            client = get_chroma_client()
            client.delete_collection("modus_research")
            collection = client.create_collection("modus_research")
        except Exception as e:
            print(f"Error resetting vector collection: {e}")
        
    print("Indexing baseline research papers in vector store...")
    rows = cursor.execute("SELECT * FROM research_sources;").fetchall()
    for row in rows:
        cits = cursor.execute("SELECT citation_string FROM citations WHERE research_source_id = ?;", (row["id"],)).fetchall()
        citation_str = ", ".join(c["citation_string"] for c in cits) if cits else "No Citation"
        index_research_source(
            source_id=row["id"],
            industry_id=row["industry_id"],
            title=row["title"],
            url=row["url"],
            citation=citation_str,
            text_content=row["content"],
            author=row["author"],
            trust_score=row["trust_score"],
            date_published=row["date_published"]
        )
    conn.close()
    print("Baseline research papers indexed successfully!")

if __name__ == "__main__":
    seed_vector_store()
