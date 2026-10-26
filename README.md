# 1. Ollama (local LLM)
ollama serve

# 2. Backend
cd backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000

# 3. Frontend
cd frontend
npx vite --port 5173

Then open http://localhost:5173.
