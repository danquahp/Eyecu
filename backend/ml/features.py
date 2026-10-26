#Turns an evidence item's own findings into a fixed-width feature vector. Used identically by train.py to build a training table from
#labelled evidence already in the database 


from __future__ import annotations

from app.models import Evidence, EvidenceType, Finding, Job, JobStatus, Severity

FEATURE_NAMES = [
    "size_mb",
    "num_tools_run",
    "num_tools_failed",
    "has_signature_mismatch",
    "num_signature_mismatch",
    "num_suspicious_pattern",
    "num_anomaly",
    "num_correlation",
    "total_findings",
    "max_confidence",
    "avg_confidence",
    "num_high_severity",
    "num_medium_severity",
    "num_low_severity",
    "is_disk_image",
    "is_memory_dump",
    "is_file_set",
    "is_mobile_extraction",
]


def extract_features(evidence: Evidence, jobs: list[Job], findings: list[Finding]) -> dict[str, float]:
    confidences = [f.confidence for f in findings]
    return {
        "size_mb": evidence.size_bytes / 1_000_000,

        "num_tools_run": len(jobs),
        
        "num_tools_failed": sum(1 for j in jobs if j.status == JobStatus.FAILED),
        
        "has_signature_mismatch": float(any(f.type == "Signature Mismatch" for f in findings)),
        
        "num_signature_mismatch": sum(1 for f in findings if f.type == "Signature Mismatch"),
        
        "num_suspicious_pattern": sum(1 for f in findings if f.type == "Suspicious Pattern"),
        
        "num_anomaly": sum(1 for f in findings if f.type == "Anomaly"),
        
        "num_correlation": sum(1 for f in findings if f.type == "Correlation"),
        
        "total_findings": len(findings),
        
        "max_confidence": max(confidences, default=0),
        
        "avg_confidence": sum(confidences) / len(confidences) if confidences else 0,
        
        
        "num_high_severity": sum(1 for f in findings if f.severity == Severity.HIGH),
        
        "num_medium_severity": sum(1 for f in findings if f.severity == Severity.MEDIUM),
        
        "num_low_severity": sum(1 for f in findings if f.severity == Severity.LOW),
        
        "is_disk_image": float(evidence.type == EvidenceType.DISK_IMAGE),
        
        "is_memory_dump": float(evidence.type == EvidenceType.MEMORY_DUMP),
        
        "is_file_set": float(evidence.type == EvidenceType.FILE_SET),
        
        "is_mobile_extraction": float(evidence.type == EvidenceType.MOBILE_EXTRACTION),
    }
