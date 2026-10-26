/*
 * Starter ruleset for the EYECU pattern-matching pipeline.
 * These are broad, low-confidence heuristics for demonstrating the YARA integration end-to-end in a vetted ruleset  before relying on
 * this for real triage.
 */

rule Brain_Boot_Sector_Virus
{
    meta:
        description = "Brain (1986) — the first PC virus, a boot-sector infector that leaves its own signature text on infected floppy disks"
        severity = "high"

    strings:
        $dungeon = "Welcome to the  Dungeon"
        $signature = "(c) 1986 Brain"
        $company = "Amjads (pvt) Ltd"

    condition:
        any of them
}

rule EICAR_Test_Signature
{
    meta:
        description = "EICAR standard antivirus test string — a harmless, industry-standard file used to verify detection pipelines, not real malware"
        severity = "high"

    strings:
        $eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"

    condition:
        $eicar
}

rule Embedded_PE_Header
{
    meta:
        description = "MZ/PE header found inside a file that may not be an executable"
        severity = "medium"

    strings:
        $mz = "MZ"
        $pe = "PE\x00\x00"

    condition:
        $mz at 0 and $pe
}

rule Possible_Credential_String
{
    meta:
        description = "Plaintext credential-like keyword near a URL scheme"
        severity = "low"

    strings:
        $pw1 = "password=" nocase
        $pw2 = "passwd=" nocase
        $url = "http" nocase

    condition:
        $url and any of ($pw1, $pw2)
}

rule Suspicious_Base64_Blob
{
    meta:
        description = "Long contiguous base64-like blob, often used to obscure payloads"
        severity = "low"

    strings:
        $b64 = /[A-Za-z0-9+\/]{200,}={0,2}/

    condition:
        $b64
}
