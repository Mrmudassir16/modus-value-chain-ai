# MODUS — Value Chain AI Opportunity Intelligence Platform

MODUS is a state-of-the-art enterprise intelligence platform designed to map business value chains, automatically identify operational pain points, map matching AI opportunities, and verify feasibility using isolated multi-lingual Retrieval-Augmented Generation (RAG).

The application is built with a sleek, premium dark-themed glassmorphism UI, using a Flask backend, SQLite for relational metadata, and ChromaDB for vector-search RAG.

---

## 🌟 Key Features

*   **Dynamic Value Chain Modeling**: Map operational value chain stages and business processes dynamically for any industry.
*   **Auto-Generated AI Opportunities**: Uses configured LLMs (Local Ollama, Google Gemini API, or OpenRouter) to evaluate pain points and auto-generate AI opportunity descriptions, specific capabilities, quantitative benefits, and risk mitigation strategies.
*   **Priority Calculation Engine**: Classifies mappings (`Low`, `Medium`, `High`, `Critical`) using a multi-factor weighting algorithm covering ROI, automation potential, business impact, implementation cost, complexity, and risk.
*   **Isolated Multi-Lingual RAG Support**:
    *   Upload research materials (PDFs/TXT files) directly into a local vector store.
    *   Dynamic semantic search to retrieve evidence and generate precise citations.
    *   Full chat session history isolation by industry to prevent context contamination.
    *   Real-time UI and database translation support for **English**, **Hindi (हिन्दी)**, **Telugu (తెలుగు)**, **Tamil (தமிழ்)**, and **Kannada (कन्नड़)**.
*   **Administration Control Panel**: Dedicated GUI to configure LLM settings, edit or delete metadata, upload files, and manage database records.

---

## 🛠️ Technology Stack

*   **Core Logic**: Python 3.10+ & Flask
*   **Database (Relational)**: SQLite (with foreign-key cascading deletes)
*   **Vector Database (Semantic)**: ChromaDB (storing localized vector embeddings)
*   **Natural Language Processing**: Hugging Face `sentence-transformers` for embeddings, integrated with Ollama, Gemini API, or OpenRouter for generative reasoning.
*   **UI/UX**: Custom HTML, JavaScript, Vanilla CSS with custom glassmorphic variables, Bootstrap 5, and Bootstrap Icons.

---

## 📁 Directory Structure

```text
MODUS/
├── instance/                  # Local databases (SQLite and ChromaDB - Git Ignored)
├── static/
│   ├── css/                   # Stylesheets (Sleek dark theme, glassmorphic effects)
│   └── js/                    # UI control scripts, AJAX handlers, chat system
├── templates/                 # HTML Templates (Base layout, Dashboard, Admin, Chat, KB)
├── ai_engine.py               # Interface to Ollama, Gemini, and OpenRouter APIs
├── app.py                     # Main Flask Application & endpoint controllers
├── config.py                  # Global settings, defaults, and supported languages
├── database.py                # SQLite connection managers and queries
├── repositories.py            # Repository patterns for DB CRUD operations
├── services.py                # Business logic (Priority calculations, translation wrapper)
├── vector_store.py            # ChromaDB interface, ingestion, and search controls
├── verify_system.py           # Integration testing suite
├── test_industry_isolation.py # Industry isolation and data sanitization tests
├── healthcare_seed.csv        # Preconfigured dataset for demo ingestion
└── requirements.txt           # Application dependencies
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Python 3.10+ installed. If you plan to use local models, install [Ollama](https://ollama.com/) and run:
```bash
ollama pull llama3
```

### 2. Setup Virtual Environment
```bash
# Clone the repository
git clone https://github.com/Mrmudassir16/modus-value-chain-ai.git
cd modus-value-chain-ai

# Create virtual environment
python -m venv venv

# Activate on Windows (Command Prompt or PowerShell)
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Initialize & Start the Server
Run the Flask server. SQLite and ChromaDB will automatically initialize their schemas on the first startup:
```bash
python app.py
```
Open your browser and navigate to `http://127.0.0.1:5000`.

### 4. Seed the Application
1. Navigate to `/admin`.
2. Select the **"Add Industry"** tab.
3. Under **"Option B: Dynamic CSV Ingestion"**, enter `Healthcare Sector` as the Industry Name and choose [healthcare_seed.csv](file:///c:/Users/abdul/OneDrive/Desktop/MODUS/healthcare_seed.csv) from the project directory.
4. Click **Ingest Industry CSV**. The engine will import the entire value chain, auto-generate opportunities, calculate priority ratings, and index corresponding research.

---

## 🧪 Testing

The test suite validates data isolation, RAG security boundaries, translation flows, and CRUD operations.

To run the integration tests, execute:
```bash
python -m unittest test_industry_isolation.py
python -m unittest verify_system.py
```

---

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for more information.
