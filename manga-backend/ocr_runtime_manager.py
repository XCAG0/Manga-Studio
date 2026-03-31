# this one too :)

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from ocr_runtime import (
    RUNTIME_SCHEMA_VERSION,
    VALID_MODES,
    configure_import_path_for_selected_runtime,
    detect_gpu_vendors,
    dml_ocr_supported,
    get_available_modes,
    get_benchmark_image_path,
    get_python_home,
    get_runtime_candidates,
    get_runtime_config_path,
    get_runtime_metadata,
    get_selected_runtime_mode,
    get_user_data_dir,
    load_runtime_config,
    save_runtime_config,
)

GPU_WIN_THRESHOLD_S = 10.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Select the fastest OCR runtime.")
    sub = parser.add_subparsers(dest="command", required=True)

    sel = sub.add_parser("select", help="Run first-launch runtime selection")
    sel.add_argument("--image", type=Path, default=get_benchmark_image_path())
    sel.add_argument("--force", action="store_true")

    prb = sub.add_parser("probe", help="Probe a single runtime")
    prb.add_argument("--mode", choices=list(VALID_MODES), required=True)
    prb.add_argument("--image", type=Path, default=get_benchmark_image_path())

    shw = sub.add_parser("show", help="Print current runtime config")
    shw.add_argument("--image", type=Path, default=get_benchmark_image_path())

    return parser.parse_args()


def emit(payload: Dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=True), flush=True)


def normalize_image_path(image_path: Path) -> Path:
    if image_path.exists():
        return image_path
    fallback = get_benchmark_image_path()
    return fallback if fallback.exists() else image_path


def build_probe_env(mode: str) -> Dict[str, str]:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONNOUSERSITE"] = "1"
    env["MANGA_STUDIO_USER_DATA"] = str(get_user_data_dir())
    env["MANGA_OCR_RUNTIME_CONFIG"] = str(get_runtime_config_path())
    env["MANGA_PYTHON_HOME"] = str(get_python_home())
    env["MANGA_OCR_RUNTIME_MODE"] = mode
    return env


def probe_runtime(mode: str, image_path: Path) -> Dict[str, Any]:
    os.environ["MANGA_OCR_RUNTIME_MODE"] = mode
    actual_mode = configure_import_path_for_selected_runtime(mode)

    image_path = normalize_image_path(image_path)
    result: Dict[str, Any] = {
        "mode": mode,
        "actual_mode": actual_mode,
        "image": str(image_path),
        "success": False,
        "elapsed_s": None,
        "processing_time": None,
    }

    if not image_path.exists():
        result["error"] = f"Benchmark image not found: {image_path}"
        return result

    if mode == "gpu":
        try:
            import paddle

            result["paddle_version"] = getattr(paddle, "__version__", "unknown")
            result["compiled_with_cuda"] = bool(paddle.is_compiled_with_cuda())

            cuda_count = 0
            try:
                cuda_count = int(paddle.device.cuda.device_count())
            except Exception:
                pass
            result["cuda_device_count"] = cuda_count

            if not result["compiled_with_cuda"] or cuda_count < 1:
                result["error"] = "No CUDA device available"
                return result

            image_b64 = _load_image_b64(image_path)
            from P_ocr import paddle_detector

            t0 = time.perf_counter()
            detect_result = paddle_detector.detect(image_b64, "en", include_text=True)
            elapsed = time.perf_counter() - t0

            result["elapsed_s"] = round(elapsed, 3)
            result["processing_time"] = detect_result.get("processingTime")
            result["count"] = detect_result.get("count", 0)
            result["success"] = bool(detect_result.get("success"))
            if not result["success"]:
                result["error"] = detect_result.get("error", "Unknown OCR error")
        except Exception as exc:
            result["error"] = str(exc)

    elif mode == "dml":
        result["supported_for_ocr"] = dml_ocr_supported()
        if not dml_ocr_supported():
            result["error"] = (
                "DirectML was detected, but the bundled OCR pipeline does not execute PaddleOCR on DirectML yet."
            )
            return result

        try:
            import onnxruntime as ort

            providers = ort.get_available_providers()
            result["ort_providers"] = providers

            if "DmlExecutionProvider" not in providers:
                result["error"] = "DmlExecutionProvider not available"
                return result

            result["ort_version"] = ort.__version__
        except Exception as exc:
            result["error"] = str(exc)

    else:
        try:
            image_b64 = _load_image_b64(image_path)
            from P_ocr import paddle_detector

            t0 = time.perf_counter()
            detect_result = paddle_detector.detect(image_b64, "en", include_text=True)
            elapsed = time.perf_counter() - t0

            result["elapsed_s"] = round(elapsed, 3)
            result["processing_time"] = detect_result.get("processingTime")
            result["count"] = detect_result.get("count", 0)
            result["success"] = bool(detect_result.get("success"))
            if not result["success"]:
                result["error"] = detect_result.get("error", "Unknown OCR error")
        except Exception as exc:
            result["error"] = str(exc)

    return result


def _load_image_b64(image_path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(image_path.read_bytes()).decode("ascii")


def parse_probe_output(stdout: str, stderr: str, mode: str) -> Dict[str, Any]:
    for line in reversed(stdout.splitlines()):
        candidate = line.strip()
        if not candidate.startswith("{"):
            continue
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return {
        "mode": mode,
        "success": False,
        "error": stderr.strip() or stdout.strip() or "Probe returned no JSON payload",
    }


def run_probe_subprocess(mode: str, image_path: Path) -> Dict[str, Any]:
    command = [
        sys.executable,
        "-u",
        str(Path(__file__).resolve()),
        "probe",
        "--mode",
        mode,
        "--image",
        str(image_path),
    ]
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            env=build_probe_env(mode),
            timeout=60 * 20,
        )
        payload = parse_probe_output(completed.stdout, completed.stderr, mode)
        payload["returncode"] = completed.returncode
        payload["stdout"] = completed.stdout[-2000:]
        payload["stderr"] = completed.stderr[-2000:]
    except subprocess.TimeoutExpired:
        payload = {"mode": mode, "success": False, "error": "Probe timed out (20 min)"}
    except Exception as exc:
        payload = {"mode": mode, "success": False, "error": str(exc)}
    return payload


def _has_successful_benchmark(config: Dict[str, Any]) -> bool:
    benchmarks = config.get("benchmarks") or {}
    return any(isinstance(result, dict) and result.get("success") for result in benchmarks.values())


def _cache_refresh_reason(
    config: Dict[str, Any],
    current_gpus: list[Dict[str, str]],
    available_modes: list[str],
    runtime_candidates: list[Dict[str, Any]],
) -> Optional[str]:
    if config.get("detected_gpus") != current_gpus:
        return "detected GPU list changed"

    selected_mode = config.get("selected_mode")
    if selected_mode not in available_modes:
        return f"selected mode '{selected_mode}' is no longer available"

    if not _has_successful_benchmark(config):
        return "cached benchmark has no successful runtime result"

    benchmarks = config.get("benchmarks") or {}
    selected_probe = benchmarks.get(selected_mode)
    if isinstance(selected_probe, dict) and not selected_probe.get("success"):
        return f"cached selected mode '{selected_mode}' previously failed"

    cached_candidates = config.get("runtime_candidates")
    if cached_candidates and cached_candidates != runtime_candidates:
        return "runtime candidates changed"

    return None


def select_runtime(image_path: Path, force: bool = False) -> Dict[str, Any]:
    config_path = get_runtime_config_path()
    current_gpus = detect_gpu_vendors()
    available = get_available_modes()
    runtime_candidates = get_runtime_candidates()

    if config_path.exists() and not force:
        existing = load_runtime_config()
        refresh_reason = (
            _cache_refresh_reason(existing, current_gpus, available, runtime_candidates)
            if existing
            else "cached config could not be loaded"
        )
        if existing and not refresh_reason:
            existing["from_cache"] = True
            return existing
        if refresh_reason:
            print(f"[OCR Runtime] Refreshing cached runtime config: {refresh_reason}", flush=True)

    image_path = normalize_image_path(image_path)
    gpu_modes = [mode for mode in available if mode != "cpu"]

    print(f"[OCR Runtime] Detected GPUs: {[g['name'] for g in current_gpus]}", flush=True)
    print(
        "[OCR Runtime] Runtime candidates: "
        + ", ".join(
            f"{candidate['mode']}={'yes' if candidate['benchmarkable'] else 'no'}"
            for candidate in runtime_candidates
        ),
        flush=True,
    )
    print(f"[OCR Runtime] Available modes to benchmark: {available}", flush=True)

    benchmarks: Dict[str, Optional[Dict[str, Any]]] = {}
    selected_mode: Optional[str] = None
    selected_time: Optional[float] = None

    for mode in gpu_modes:
        print(f"[OCR Runtime] Benchmarking {mode}...", flush=True)
        benchmarks[mode] = run_probe_subprocess(mode, image_path)
        probe = benchmarks[mode]
        probe_time = _get_time(probe)
        if probe and probe.get("success") and probe_time <= GPU_WIN_THRESHOLD_S:
            selected_mode = mode
            selected_time = probe_time
            print(
                f"[OCR Runtime] {mode} finished in {probe_time:.2f}s which is below the "
                f"{GPU_WIN_THRESHOLD_S:.2f}s threshold. Skipping CPU benchmark.",
                flush=True,
            )
            break

    if selected_mode is None:
        print("[OCR Runtime] Benchmarking cpu...", flush=True)
        benchmarks["cpu"] = run_probe_subprocess("cpu", image_path)
        selected_mode = "cpu"
        selected_time = _get_time(benchmarks["cpu"])

        for mode in gpu_modes:
            probe = benchmarks.get(mode)
            if not probe or not probe.get("success"):
                continue
            probe_time = _get_time(probe)
            if probe_time < selected_time:
                selected_time = probe_time
                selected_mode = mode

    if selected_time >= 1e9:
        print("[OCR Runtime] All runtime benchmarks failed. Falling back to cpu startup mode.", flush=True)

    print(f"[OCR Runtime] Selected: {selected_mode} ({selected_time:.2f}s)", flush=True)

    config = {
        "schema_version": RUNTIME_SCHEMA_VERSION,
        "selected_mode": selected_mode,
        "benchmark_image": str(image_path),
        "threshold_seconds": GPU_WIN_THRESHOLD_S,
        "benchmarked_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "detected_gpus": current_gpus,
        "available_modes": available,
        "runtime_candidates": runtime_candidates,
        "benchmarks": benchmarks,
        "all_benchmarks_failed": selected_time >= 1e9,
        "python_home": str(get_python_home()),
    }
    save_runtime_config(config)
    return config


def _get_time(result: Optional[Dict[str, Any]]) -> float:
    if not result:
        return 1e9
    return float(result.get("processing_time") or result.get("elapsed_s") or 1e9)


def main() -> int:
    args = parse_args()

    if args.command == "probe":
        payload = probe_runtime(args.mode, args.image)
        emit(payload)
        return 0 if payload.get("success") else 1

    if args.command == "select":
        payload = select_runtime(args.image, force=args.force)
        emit(payload)
        return 0

    if args.command == "show":
        payload = load_runtime_config()
        if not payload:
            payload = {
                "schema_version": RUNTIME_SCHEMA_VERSION,
                "selected_mode": get_selected_runtime_mode(),
                "metadata": get_runtime_metadata(),
                "exists": False,
            }
        else:
            payload["exists"] = True
        emit(payload)
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
