import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("MODUS_DB_PATH", os.path.join(BASE_DIR, 'instance', 'modus.db'))
CHROMA_PATH = os.environ.get("MODUS_CHROMA_PATH", os.path.join(BASE_DIR, 'instance', 'chroma_db'))

SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi (हिन्दी)",
    "te": "Telugu (తెలుగు)",
    "ta": "Tamil (தமிழ்)",
    "kn": "Kannada (कन्नड़)"
}

LLM_SETTINGS_DEFAULTS = {
    "llm_provider": "ollama",
    "ollama_host": "http://localhost:11434",
    "llm_model": "llama3",
    "openrouter_key": ""
}
