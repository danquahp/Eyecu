from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from ..models import ToolName
from ..services.browse import extract_file, list_all_files
from .base import AdapterResult, TimelineDraft, ToolAdapter
from .sleuthkit_common import ensure_raw_readable, find_main_partition_offset

_HIVE_PATH_SUFFIX = "system32/config/system"


@dataclass
class UsbDevice:
    device_id: str 
    serial: str
    friendly_name: str | None
    last_connected: datetime 


def _find_system_hive(image_path: Path) -> str | None:


    candidates = [
        e for e in list_all_files(image_path) if e.path.lower().replace("\\", "/").endswith(_HIVE_PATH_SUFFIX)
    ]
    if not candidates:
        return None

    
    candidates.sort(key=lambda e: ("regback" in e.path.lower(), "$recycle.bin" in e.path.lower()))
    
    return candidates[0].inode


def _read_usb_history(hive_path: Path) -> list[UsbDevice]:
    from Registry import Registry

    reg = Registry.Registry(str(hive_path))
    root = reg.root()

    not_found = (Registry.RegistryKeyNotFoundException, Registry.RegistryValueNotFoundException)



    current = "001"

    try:
        current = f"{root.subkey('Select').value('Current').value():03d}"
    except not_found:
        pass

    try:
        usbstor = root.subkey(f"ControlSet{current}").subkey("Enum").subkey("USBSTOR")
    except not_found:
        return []  # no USB storage history recorded on this image



    devices: list[UsbDevice] = []
    for device_key in usbstor.subkeys():
        for instance in device_key.subkeys():
            friendly_name = None
            try:
                friendly_name = instance.value("FriendlyName").value()
            except not_found:
                pass
            devices.append(
                UsbDevice(
                    device_id=device_key.name(),
                    serial=instance.name(),
                    friendly_name=friendly_name,
                    last_connected=instance.timestamp().replace(tzinfo=timezone.utc),
                )
            )


    return devices


class UsbHistoryAdapter(ToolAdapter):


    name = ToolName.USB_HISTORY
    binary = "" 

    def is_available(self) -> bool:
        try:
            import Registry  # noqa: F401

            return True
        except ImportError:
            return False



    def version(self) -> str:
        try:
            import Registry

            return getattr(Registry, "__version__", "python-registry")
        except ImportError:
            return "not installed"





    def run(self, evidence_path: Path, workdir: Path) -> AdapterResult:
        raw_path = ensure_raw_readable(evidence_path)

        find_main_partition_offset(raw_path)  # just confirms the image has a readable partition table

        inode = _find_system_hive(evidence_path)
        if inode is None:
            raise RuntimeError(
                "No Windows System registry hive found"
                "Usb history requires a Windows ntfs image"
            )

        hive_path = extract_file(evidence_path, inode, workdir)
        devices = _read_usb_history(hive_path)

        timeline_events = [
            TimelineDraft(
                time=d.last_connected,
                description=(
                    f"USB device last connected: {d.friendly_name or d.device_id} "
                    f"(serial {d.serial})"
                ),
            )
            for d in devices
        ]


        timeline_events.sort(key=lambda t: t.time, reverse=True)

        log = f"System hive's USBSTOR history: {len(devices)} USB storage devices recorded."
        
        metadata = {
            "devices": [
                {
                    "device_id": d.device_id,
                    "serial": d.serial,
                    "friendly_name": d.friendly_name,
                    "last_connected": d.last_connected.isoformat(),
                }
                for d in devices
            ]
        }
        
        return AdapterResult(log=log, findings=[], timeline_events=timeline_events, metadata=metadata)
