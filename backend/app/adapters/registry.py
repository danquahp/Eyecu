from ..models import ToolName
from .base import ToolAdapter
from .bulk_extractor_adapter import BulkExtractorAdapter
from .exiftool_adapter import ExifToolAdapter
from .sleuthkit_adapter import SleuthKitAdapter
from .usb_history_adapter import UsbHistoryAdapter
from .volatility_adapter import VolatilityAdapter
from .yara_adapter import YaraAdapter

ADAPTERS: dict[ToolName, ToolAdapter] = {
    ToolName.AUTOPSY: SleuthKitAdapter(),
    ToolName.VOLATILITY: VolatilityAdapter(),
    ToolName.EXIFTOOL: ExifToolAdapter(),
    ToolName.YARA: YaraAdapter(),
    ToolName.BULK_EXTRACTOR: BulkExtractorAdapter(),
    ToolName.USB_HISTORY: UsbHistoryAdapter(),
}


def get_adapter(tool: ToolName) -> ToolAdapter:
    adapter = ADAPTERS.get(tool)
    if adapter is None:
        raise ValueError(f"No adapter registered for tool: {tool}")
    return adapter
