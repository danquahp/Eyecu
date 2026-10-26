from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .db import init_db
from .routers import ai, browse, cases, evidence, findings, jobs, ml, timeline, tools
from .services.jobs import start_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    await start_worker()
    yield


app = FastAPI(title="EYECU Forensic Platform API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases.router)
app.include_router(evidence.router)
app.include_router(tools.router)
app.include_router(findings.router)
app.include_router(timeline.router)
app.include_router(jobs.router)
app.include_router(browse.router)
app.include_router(ai.router)
app.include_router(ml.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
