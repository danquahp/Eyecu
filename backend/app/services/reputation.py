from __future__ import annotations
import os
import httpx

VT_URL = "https://www.virustotal.com/api/v3/files/{sha256}"


def is_configured() -> bool:
    return bool(os.environ.get("VIRUSTOTAL_API_KEY"))


async def check_hash(sha256: str) -> dict:
    #Looks up a file's SHA-256 against VirusTotal's database.
    api_key = os.environ.get("VIRUSTOTAL_API_KEY")
    
    if not api_key:
        return {
            "configured": False,
            "note": "VIRUSTOTAL_API_KEY environment variable required to enable reputation checks.",
        }


    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.get(VT_URL.format(sha256=sha256), headers={"x-apikey": api_key})


    if res.status_code == 404:
        return {
            "configured": True,
            "known_to_virustotal": False,
            "note": "No file with this hash has been seen by VirusTotal before. This does not mean it's safe — only that it isn't a previously catalogued sample.",
        }

    
    if res.status_code != 200:
        return {
            "configured": True,
            "error": f"VirusTotal returned {res.status_code}: {res.text[:300]}",
        }


    data = res.json().get("data", {}).get("attributes", {})
    stats = data.get("last_analysis_stats", {})
    results = data.get("last_analysis_results", {})

    
    detections = sorted(
        {r["result"] for r in results.values() if r.get("category") == "malicious" and r.get("result")}
    )

    return {
        "configured": True,
        "known_to_virustotal": True,
        "malicious_votes": stats.get("malicious", 0),
        "suspicious_votes": stats.get("suspicious", 0),
        "harmless_votes": stats.get("harmless", 0),
        "undetected_votes": stats.get("undetected", 0),
        "total_engines": sum(stats.values()) if stats else 0,
        "detection_names": detections[:10],
        "names_seen": data.get("names", [])[:5],
    }
