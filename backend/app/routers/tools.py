from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from ..adapters.registry import ADAPTERS
from ..db import get_session
from ..models import Job, JobStatus, ToolName
from ..schemas import ToolStatusOut

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("", response_model=list[ToolStatusOut])
def list_tools(session: Session = Depends(get_session)) -> list[ToolStatusOut]:
    active_counts = dict(
        session.exec(
            select(Job.tool, func.count(Job.id)).where(Job.status == JobStatus.RUNNING).group_by(Job.tool)
        ).all()
    )

    out: list[ToolStatusOut] = []
    for tool in ToolName:
        adapter = ADAPTERS.get(tool)
        if adapter is None:
            out.append(
                ToolStatusOut(
                    name=tool,
                    connected=False,
                    version="n/a",
                    jobs_active=0,
                    detail="No adapter implemented yet",
                )
            )
            continue

        connected = adapter.is_available()
        out.append(
            ToolStatusOut(
                name=tool,
                connected=connected,
                version=adapter.version() if connected else "not available",
                jobs_active=active_counts.get(tool, 0),
                detail=None if connected else "Binary not found on host",
            )
        )
    return out
