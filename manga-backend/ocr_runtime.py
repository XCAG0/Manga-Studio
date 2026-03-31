# i used Ai to make this file ;)

from __future__ import annotations

import json
import os
import subprocess
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

RUNTIME_SCHEMA_VERSION = 3
RUNTIME_CONFIG_NAME = "ocr-runtime.json"

# ──────────────────────────────────────────────
# Directory helpers
# ──────────────────────────────────────────────

def get_backend_dir() -> Path:
    return Path(__file__).resolve().parent


def get_python_home() -> Path:
    env_path = os.environ.get("MANGA_PYTHON_HOME")
    if env_path:
        return Path(env_path)
    bundled_python = get_backend_dir().parent / "python-embed"
    if bundled_python.exists():
        return bundled_python
    return Path(sys.executable).resolve().parent


def get_user_data_dir() -> Path:
    env_path = os.environ.get("MANGA_STUDIO_USER_DATA")
    path = Path(env_path) if env_path else get_backend_dir() / ".runtime"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_runtime_config_path() -> Path:
    env_path = os.environ.get("MANGA_OCR_RUNTIME_CONFIG")
    if env_path:
        return Path(env_path)
    return get_user_data_dir() / RUNTIME_CONFIG_NAME


def get_benchmark_image_path() -> Path:
    env_path = os.environ.get("MANGA_OCR_BENCHMARK_IMAGE")
    if env_path:
        return Path(env_path)
    return get_backend_dir() / "test.png"


# ──────────────────────────────────────────────
# Backend directory layout
#
#   python-embed/
#     gpu-site-packages/        ← paddle CUDA (NVIDIA)
#     gpu-runtime-packages/     ← CUDA DLLs
#     dml-site-packages/        ← onnxruntime-directml (AMD/Intel/any DX12)
# ──────────────────────────────────────────────

def get_gpu_site_packages_dir() -> Path:
    return get_python_home() / "gpu-site-packages"

def get_gpu_runtime_packages_dir() -> Path:
    return get_python_home() / "gpu-runtime-packages"

def get_dml_site_packages_dir() -> Path:
    return get_python_home() / "dml-site-packages"


def get_gpu_dll_directories() -> List[Path]:
    runtime_root = get_gpu_runtime_packages_dir()
    candidates = [
        runtime_root / "nvidia" / "cuda_runtime"  / "bin",
        runtime_root / "nvidia" / "cuda_nvrtc"    / "bin",
        runtime_root / "nvidia" / "cublas"         / "bin",
        runtime_root / "nvidia" / "cudnn"          / "bin",
        get_gpu_site_packages_dir(),
    ]
    return [p for p in candidates if p.exists()]


# ──────────────────────────────────────────────
# GPU vendor detection (works on any Windows machine)
# ──────────────────────────────────────────────

@lru_cache(maxsize=1)
def detect_gpu_vendors() -> List[Dict[str, str]]:
    """
    Returns list of GPUs detected on Windows.
    Tries PowerShell/CIM first because `wmic` is removed on newer Windows builds,
    then falls back to `wmic` for older installs.
    Each entry: {"name": "...", "vendor": "nvidia"|"amd"|"intel"|"other"}
    """
    import tempfile

    gpus: List[Dict[str, str]] = []

    def _parse_lines(lines: list) -> List[Dict[str, str]]:
        result = []
        for line in lines:
            line = line.strip()
            if not line or "|" not in line:
                continue

            compatibility, name = line.split("|", 1)
            compatibility = compatibility.strip().lower()
            name = name.strip()
            if not name:
                continue

            name_lower = name.lower()
            if (
                "nvidia" in compatibility
                or "nvidia" in name_lower
                or "geforce" in name_lower
                or "quadro" in name_lower
            ):
                vendor = "nvidia"
            elif "advanced micro" in compatibility or "amd" in name_lower or "radeon" in name_lower:
                vendor = "amd"
            elif "intel" in compatibility or "intel" in name_lower:
                vendor = "intel"
            else:
                vendor = "other"

            result.append({"name": name, "vendor": vendor})

        return result

    try:
        dollar = "$"
        ps_lines = [
            "Get-CimInstance Win32_VideoController | ForEach-Object {",
            f"    {dollar}_.AdapterCompatibility + '|' + {dollar}_.Name",
            "}",
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".ps1", delete=False, encoding="utf-8") as tmp:
            tmp.write("\n".join(ps_lines))
            ps_path = tmp.name

        proc = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                ps_path,
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        try:
            os.unlink(ps_path)
        except Exception:
            pass

        gpus = _parse_lines(proc.stdout.splitlines())
        if gpus:
            return gpus
    except Exception:
        pass

    try:
        result = subprocess.run(
            ["wmic", "path", "win32_VideoController", "get", "Name,AdapterCompatibility", "/format:csv"],
            capture_output=True, text=True, timeout=10
        )
        for line in result.stdout.splitlines():
            line = line.strip()
            if not line or line.lower().startswith("node"):
                continue
            parts = line.split(",")
            if len(parts) < 3:
                continue
            compatibility = parts[1].strip().lower()
            name = parts[2].strip()
            if not name:
                continue
            name_lower = name.lower()
            if "nvidia" in compatibility or "nvidia" in name_lower or "geforce" in name_lower:
                vendor = "nvidia"
            elif "advanced micro" in compatibility or "amd" in name_lower or "radeon" in name_lower:
                vendor = "amd"
            elif "intel" in compatibility or "intel" in name_lower:
                vendor = "intel"
            else:
                vendor = "other"
            gpus.append({"name": name, "vendor": vendor})
    except Exception:
        pass
    return gpus


def has_nvidia_gpu() -> bool:
    return any(g["vendor"] == "nvidia" for g in detect_gpu_vendors())

def has_amd_gpu() -> bool:
    return any(g["vendor"] == "amd" for g in detect_gpu_vendors())

def has_intel_gpu() -> bool:
    return any(g["vendor"] == "intel" for g in detect_gpu_vendors())

def has_any_gpu() -> bool:
    return bool(detect_gpu_vendors())

def has_any_discrete_gpu() -> bool:
    vendors = {g["vendor"] for g in detect_gpu_vendors()}
    return bool(vendors - {"intel"})  # discrete = anything except integrated Intel


# ──────────────────────────────────────────────
# Availability checks per backend
# ──────────────────────────────────────────────

def gpu_overlay_available() -> bool:
    """NVIDIA CUDA paddle overlay."""
    overlay = get_gpu_site_packages_dir()
    return overlay.exists() and (overlay / "paddle").exists()


def dml_overlay_available() -> bool:
    """DirectML onnxruntime overlay (AMD / Intel / any DX12 GPU)."""
    dml = get_dml_site_packages_dir()
    if not dml.exists():
        return False
    # must have onnxruntime with DirectML support
    ort_dir = dml / "onnxruntime"
    return ort_dir.exists()


def dml_ocr_supported() -> bool:
    """
    The bundled OCR pipeline is PaddleOCR. On Windows, the real accelerated OCR
    path we ship today is CUDA via NVIDIA. DirectML is detected for future use,
    but it is not yet a true OCR execution backend here.
    """
    return False


def get_runtime_candidates() -> List[Dict[str, Any]]:
    gpus = detect_gpu_vendors()
    gpu_names = [gpu["name"] for gpu in gpus]
    candidates: List[Dict[str, Any]] = []

    if has_nvidia_gpu():
        candidates.append(
            {
                "mode": "gpu",
                "label": "NVIDIA CUDA",
                "benchmarkable": gpu_overlay_available(),
                "supported_for_ocr": gpu_overlay_available(),
                "reason": None if gpu_overlay_available() else "NVIDIA GPU detected, but the bundled CUDA Paddle runtime is missing.",
                "detected_gpu_names": [gpu["name"] for gpu in gpus if gpu["vendor"] == "nvidia"],
            }
        )
    elif gpu_overlay_available():
        candidates.append(
            {
                "mode": "gpu",
                "label": "NVIDIA CUDA",
                "benchmarkable": False,
                "supported_for_ocr": False,
                "reason": "CUDA runtime is bundled, but no NVIDIA GPU was detected on this machine.",
                "detected_gpu_names": gpu_names,
            }
        )

    if has_any_gpu():
        candidates.append(
            {
                "mode": "dml",
                "label": "DirectML",
                "benchmarkable": dml_overlay_available() and dml_ocr_supported(),
                "supported_for_ocr": dml_overlay_available() and dml_ocr_supported(),
                "reason": (
                    "DirectML runtime is bundled, but the current PaddleOCR pipeline does not execute OCR on DirectML yet."
                    if dml_overlay_available()
                    else "GPU detected, but no DirectML runtime bundle was found."
                ),
                "detected_gpu_names": gpu_names,
            }
        )

    candidates.append(
        {
            "mode": "cpu",
            "label": "CPU",
            "benchmarkable": True,
            "supported_for_ocr": True,
            "reason": None,
            "detected_gpu_names": [],
        }
    )

    return candidates


def get_available_modes() -> List[str]:
    """Returns benchmarkable OCR backends on this machine, best-first."""
    return [candidate["mode"] for candidate in get_runtime_candidates() if candidate["benchmarkable"]]


# ──────────────────────────────────────────────
# Runtime config persistence
# ──────────────────────────────────────────────

def load_runtime_config() -> Dict[str, Any]:
    config_path = get_runtime_config_path()
    if not config_path.exists():
        return {}
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
        if int(config.get("schema_version", 0)) != RUNTIME_SCHEMA_VERSION:
            return {}
        return config
    except Exception:
        return {}


def save_runtime_config(config: Dict[str, Any]) -> None:
    config_path = get_runtime_config_path()
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")


# ──────────────────────────────────────────────
# Mode selection
# ──────────────────────────────────────────────

VALID_MODES = {"cpu", "gpu", "dml"}


def get_selected_runtime_mode(default: str = "cpu") -> str:
    env_mode = os.environ.get("MANGA_OCR_RUNTIME_MODE", "").strip().lower()
    if env_mode in VALID_MODES:
        return _validate_mode(env_mode)

    config = load_runtime_config()
    config_mode = str(config.get("selected_mode", default)).strip().lower()
    return _validate_mode(config_mode if config_mode in VALID_MODES else default)


def _validate_mode(mode: str) -> str:
    """Downgrade requested mode if the required backend is unavailable."""
    available_modes = set(get_available_modes())
    if mode == "gpu" and "gpu" not in available_modes:
        return "cpu"
    if mode == "dml" and "dml" not in available_modes:
        return "cpu"
    return mode


# ──────────────────────────────────────────────
# sys.path / DLL injection
# ──────────────────────────────────────────────

_DLL_PATHS: list[Any] = []
_RUNTIME_CONFIGURED = False


def configure_import_path_for_selected_runtime(mode: str | None = None) -> str:
    global _RUNTIME_CONFIGURED
    selected_mode = _validate_mode((mode or get_selected_runtime_mode()).strip().lower())

    if _RUNTIME_CONFIGURED:
        return selected_mode

    if selected_mode == "gpu":
        _inject_path(get_gpu_site_packages_dir())
        _inject_path(get_gpu_runtime_packages_dir())
        for dll_dir in get_gpu_dll_directories():
            _add_dll_dir(str(dll_dir))

    elif selected_mode == "dml":
        _inject_path(get_dml_site_packages_dir())

    if selected_mode not in ("gpu",):
        os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")

    _RUNTIME_CONFIGURED = True
    return selected_mode


def _inject_path(directory: Path) -> None:
    if directory.exists():
        s = str(directory)
        if s not in sys.path:
            sys.path.insert(0, s)


def _add_dll_dir(dll_dir: str) -> None:
    os.environ["PATH"] = dll_dir + os.pathsep + os.environ.get("PATH", "")
    if os.name == "nt" and hasattr(os, "add_dll_directory"):
        try:
            _DLL_PATHS.append(os.add_dll_directory(dll_dir))
        except OSError:
            pass


# ──────────────────────────────────────────────
# Metadata
# ──────────────────────────────────────────────

def get_runtime_metadata() -> Dict[str, Any]:
    selected_mode = get_selected_runtime_mode()
    gpus = detect_gpu_vendors()
    return {
        "selected_mode": selected_mode,
        "device": _mode_to_device_label(selected_mode),
        "available_modes": get_available_modes(),
        "runtime_candidates": get_runtime_candidates(),
        "detected_gpus": gpus,
        "has_any_gpu": has_any_gpu(),
        "has_any_discrete_gpu": has_any_discrete_gpu(),
        "gpu_overlay_available": gpu_overlay_available(),
        "dml_overlay_available": dml_overlay_available(),
        "dml_ocr_supported": dml_ocr_supported(),
        "gpu_site_packages_dir": str(get_gpu_site_packages_dir()),
        "dml_site_packages_dir": str(get_dml_site_packages_dir()),
        "gpu_runtime_packages_dir": str(get_gpu_runtime_packages_dir()),
        "gpu_dll_directories": [str(p) for p in get_gpu_dll_directories()],
        "runtime_config_path": str(get_runtime_config_path()),
        "benchmark_image_path": str(get_benchmark_image_path()),
        "schema_version": RUNTIME_SCHEMA_VERSION,
    }


def _mode_to_device_label(mode: str) -> str:
    gpus = detect_gpu_vendors()
    if mode == "gpu":
        nvidia = [g["name"] for g in gpus if g["vendor"] == "nvidia"]
        return f"gpu:0 ({nvidia[0]})" if nvidia else "gpu:0"
    if mode == "dml":
        if gpus:
            return f"cpu (DirectML OCR unavailable; detected {gpus[0]['name']})"
        return "cpu (DirectML OCR unavailable)"
    return "cpu"
