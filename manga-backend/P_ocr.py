import base64
import os
import time
import warnings
from io import BytesIO
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in os.sys.path:
    os.sys.path.insert(0, str(SCRIPT_DIR))

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["DISABLE_MODEL_SOURCE_CHECK"] = "True"
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
os.environ["PADDLE_PDX_MODEL_SOURCE"] = "BOS"

try:
    from requests import RequestsDependencyWarning

    warnings.filterwarnings("ignore", category=RequestsDependencyWarning)
except Exception:
    pass

from ocr_runtime import configure_import_path_for_selected_runtime, get_runtime_metadata

RUNTIME_META = get_runtime_metadata()
RUNTIME_MODE = configure_import_path_for_selected_runtime(RUNTIME_META["selected_mode"])
DEFAULT_OCR_DEVICE = "gpu:0" if RUNTIME_MODE == "gpu" else "cpu"

import cv2
import numpy as np
from PIL import Image
from paddleocr import TextDetection, TextRecognition

SEGMENT_HEIGHT = 3700
OVERLAP = 600
DET_SCORE_THRESHOLD = 0.5
REC_SCORE_THRESHOLD = 0.5
REC_BATCH_SIZE = 48
DET_CPU_THREADS = int(os.environ.get("MANGA_OCR_DET_THREADS", "6"))
REC_CPU_THREADS = int(os.environ.get("MANGA_OCR_REC_THREADS", "2"))
FULL_PAGE_RESCUE_MAX_HEIGHT = int(os.environ.get("MANGA_OCR_FULL_RESCUE_MAX_HEIGHT", "12000"))
FULL_PAGE_RESCUE_MAX_PIXELS = int(os.environ.get("MANGA_OCR_FULL_RESCUE_MAX_PIXELS", "18000000"))
BOUNDARY_RESCUE_MARGIN = int(os.environ.get("MANGA_OCR_BOUNDARY_RESCUE_MARGIN", "140"))
DUPLICATE_OVERLAP_RATIO = float(os.environ.get("MANGA_OCR_DUPLICATE_OVERLAP_RATIO", "0.35"))
DUPLICATE_IOU_RATIO = float(os.environ.get("MANGA_OCR_DUPLICATE_IOU_RATIO", "0.18"))
DUPLICATE_VERTICAL_GAP = int(os.environ.get("MANGA_OCR_DUPLICATE_VERTICAL_GAP", "28"))
DUPLICATE_CENTER_GAP_RATIO = float(os.environ.get("MANGA_OCR_DUPLICATE_CENTER_GAP_RATIO", "0.42"))
DUPLICATE_MIN_AREA_STRICT_RATIO = float(os.environ.get("MANGA_OCR_DUPLICATE_MIN_AREA_STRICT_RATIO", "0.72"))
DUPLICATE_HEIGHT_RATIO = float(os.environ.get("MANGA_OCR_DUPLICATE_HEIGHT_RATIO", "0.45"))


class PaddleBubbleDetector:
    """Fast OCR detector/reader based on PaddleOCR v3 modules."""

    def __init__(self):
        self.detector = None
        self.recognizers = {}
        self.current_lang = None
        self.is_initialized = False
        self.device = DEFAULT_OCR_DEVICE
        self.lang_map = {
            "korean": "korean",
            "japan": "japan",
            "ch": "ch",
            "en": "en",
            "ar": "ar",
        }

    def initialize(self, lang="en"):
        """Initialize detector and matching recognizer."""
        return self._initialize_for_device(lang, allow_fallback=True)

    def _initialize_for_device(self, lang="en", allow_fallback=True):
        """Initialize detector and matching recognizer on the active device."""
        paddle_lang = self.lang_map.get(lang, "en")

        if self.detector is None:
            print(f"[PaddleOCR] Initializing detector on {self.device}...")
            detector_kwargs = dict(
                model_name="PP-OCRv5_server_det",
                device=self.device,
                enable_hpi=False,
                enable_mkldnn=False,
            )
            if self.device == "cpu":
                detector_kwargs["cpu_threads"] = DET_CPU_THREADS
            try:
                self.detector = TextDetection(**detector_kwargs)
                print("[PaddleOCR] Detector ready!")
            except Exception as exc:
                if self.device == "gpu:0" and allow_fallback:
                    print(f"[PaddleOCR] GPU detector init failed, falling back to CPU: {exc}")
                    self._activate_cpu_fallback()
                    return self._initialize_for_device(lang, allow_fallback=False)
                raise

        self._get_recognizer(paddle_lang)
        self.current_lang = lang
        self.is_initialized = True
        print(f"[PaddleOCR] Ready! (lang={paddle_lang}, device={self.device})")

    def detect(self, image_b64, lang="en", include_text=True):
        """Detect text and return grouped bubbles."""
        start_time = time.time()
        self.initialize(lang)

        try:
            img = self._decode_base64(image_b64)
            if img is None:
                return {"success": False, "error": "Failed to decode image", "bubbles": []}

            h, w = img.shape[:2]
            print(f"[PaddleOCR] Image size: {w}x{h}")

            lines = self._detect_lines(img)
            if include_text and lines:
                self._recognize_lines(img, lines, self.lang_map.get(lang, "en"))

            merged = self._merge_overlapping(lines)
            bubbles = self._group_into_bubbles(merged)
            result_bubbles = self._to_api_format(bubbles)

            processing_time = time.time() - start_time
            print(
                f"[PaddleOCR] Detected {len(result_bubbles)} bubbles in "
                f"{processing_time:.2f}s (include_text={include_text})"
            )

            return {
                "success": True,
                "bubbles": result_bubbles,
                "count": len(result_bubbles),
                "processingTime": round(processing_time, 2),
                "engine": "paddleocr",
            }
        except Exception as e:
            print(f"[PaddleOCR] Error: {e}")
            import traceback

            traceback.print_exc()
            return {"success": False, "error": str(e), "bubbles": []}

    def _get_recognizer(self, paddle_lang):
        if paddle_lang not in self.recognizers:
            model_name = self._get_rec_model_name(paddle_lang)
            print(f"[PaddleOCR] Initializing recognizer: {model_name} on {self.device}")
            recognizer_kwargs = dict(
                model_name=model_name,
                device=self.device,
                enable_hpi=False,
                enable_mkldnn=False,
            )
            if self.device == "cpu":
                recognizer_kwargs["cpu_threads"] = REC_CPU_THREADS
            try:
                self.recognizers[paddle_lang] = TextRecognition(**recognizer_kwargs)
            except Exception as exc:
                if self.device == "gpu:0":
                    print(f"[PaddleOCR] GPU recognizer init failed, falling back to CPU: {exc}")
                    self._activate_cpu_fallback()
                    return self._get_recognizer(paddle_lang)
                raise
        return self.recognizers[paddle_lang]

    def _activate_cpu_fallback(self):
        self.device = "cpu"
        self.detector = None
        self.recognizers = {}
        self.current_lang = None
        self.is_initialized = False

    def _get_rec_model_name(self, paddle_lang):
        if paddle_lang in ("ch", "chinese_cht", "japan"):
            return "PP-OCRv5_server_rec"
        if paddle_lang == "en":
            return "en_PP-OCRv5_mobile_rec"
        if paddle_lang == "korean":
            return "korean_PP-OCRv5_mobile_rec"
        if paddle_lang == "ar":
            return "arabic_PP-OCRv5_mobile_rec"
        return "PP-OCRv5_server_rec"

    def _decode_base64(self, b64_string):
        """Decode a base64 image."""
        try:
            if "," in b64_string:
                b64_string = b64_string.split(",", 1)[1]
            img_bytes = base64.b64decode(b64_string)
            img = Image.open(BytesIO(img_bytes))
            if img.mode == "RGBA":
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[3])
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")
            return np.array(img)[:, :, ::-1].copy()
        except Exception:
            return None

    def _build_segments(self, height):
        if height <= SEGMENT_HEIGHT:
            return [(0, height)]

        segments = []
        y = 0
        while y < height:
            y_end = min(y + SEGMENT_HEIGHT, height)
            segments.append((y, y_end))
            y += SEGMENT_HEIGHT - OVERLAP
        return segments

    def _detect_lines(self, img):
        h, _ = img.shape[:2]
        segments = self._build_segments(h)
        lines = []
        errors = 0

        if len(segments) > 1:
            print(f"[PaddleOCR] Processing {len(segments)} segments...")

        for idx, (y_start, y_end) in enumerate(segments):
            segment_num = idx + 1
            segment_img = img[y_start:y_end, :]
            segment_start = time.time()
            print(
                f"[PaddleOCR] Segment {segment_num}/{len(segments)}: "
                f"y={y_start}:{y_end} size={segment_img.shape[1]}x{segment_img.shape[0]}"
            )

            try:
                results = self.detector.predict(segment_img)
                self._append_segment_detections(
                    lines,
                    results,
                    y_start,
                    y_end,
                    segment_num,
                    len(segments),
                    source="segment",
                )
                elapsed = time.time() - segment_start
                print(
                    f"[PaddleOCR] Segment {segment_num}/{len(segments)} done in "
                    f"{elapsed:.2f}s lines_total={len(lines)}"
                )
            except Exception as e:
                errors += 1
                elapsed = time.time() - segment_start
                print(f"[PaddleOCR] Segment {segment_num}/{len(segments)} error after {elapsed:.2f}s: {e}")

        if errors == len(segments):
            raise RuntimeError("All OCR segments failed during detection")

        rescue_lines = self._detect_boundary_rescue_lines(img, segments)
        if rescue_lines:
            print(f"[PaddleOCR] Boundary rescue added {len(rescue_lines)} lines")
            lines.extend(rescue_lines)

        return lines

    def _append_segment_detections(
        self,
        lines,
        results,
        y_offset,
        y_end,
        segment_num,
        segment_count,
        source="segment",
    ):
        for res in results:
            if not hasattr(res, "keys"):
                continue

            dt_polys = res.get("dt_polys", [])
            dt_scores = res.get("dt_scores", [])
            print(
                f"[PaddleOCR] Segment {segment_num}/{segment_count} raw det: "
                f"polys={len(dt_polys)} scores={len(dt_scores)}"
            )

            for i, poly in enumerate(dt_polys):
                score = float(dt_scores[i]) if i < len(dt_scores) else 0.0
                if score < DET_SCORE_THRESHOLD:
                    continue

                poly_points = [[int(p[0]), int(p[1]) + y_offset] for p in poly]
                x1 = min(p[0] for p in poly_points)
                y1 = min(p[1] for p in poly_points)
                x2 = max(p[0] for p in poly_points)
                y2 = max(p[1] for p in poly_points)

                lines.append(
                    {
                        "bbox": (x1, y1, x2, y2),
                        "poly": poly_points,
                        "text": "",
                        "confidence": score,
                        "source": source,
                        "segment_index": segment_num - 1,
                        "segment_start": y_offset,
                        "segment_end": y_end,
                    }
                )

    def _should_run_boundary_rescue(self, img, segments):
        if self.device != "gpu:0" or len(segments) <= 1:
            return False

        h, w = img.shape[:2]
        return h <= FULL_PAGE_RESCUE_MAX_HEIGHT and (h * w) <= FULL_PAGE_RESCUE_MAX_PIXELS

    def _detect_boundary_rescue_lines(self, img, segments):
        if not self._should_run_boundary_rescue(img, segments):
            return []

        boundaries = [y_end for _, y_end in segments[:-1]]
        if not boundaries:
            return []

        print("[PaddleOCR] Running full-page boundary rescue...")
        start = time.time()
        rescue_lines = []

        try:
            results = self.detector.predict(img)
            self._append_segment_detections(
                rescue_lines,
                results,
                0,
                img.shape[0],
                1,
                1,
                source="full_page_rescue",
            )
        except Exception as exc:
            print(f"[PaddleOCR] Boundary rescue failed: {exc}")
            return []

        kept = [
            line
            for line in rescue_lines
            if self._is_near_any_boundary(line["bbox"], boundaries, BOUNDARY_RESCUE_MARGIN)
        ]
        elapsed = time.time() - start
        print(
            f"[PaddleOCR] Boundary rescue done in {elapsed:.2f}s "
            f"raw={len(rescue_lines)} kept={len(kept)}"
        )
        return kept

    def _is_near_any_boundary(self, bbox, boundaries, margin):
        _, y1, _, y2 = bbox
        return any((y1 - margin) <= boundary <= (y2 + margin) for boundary in boundaries)

    def _recognize_lines(self, img, lines, paddle_lang):
        recognizer = self._get_recognizer(paddle_lang)
        crops = []
        crop_map = []
        h, w = img.shape[:2]

        for idx, line in enumerate(lines):
            x1, y1, x2, y2 = line["bbox"]
            pad_x = max(2, int((x2 - x1) * 0.08))
            pad_y = max(2, int((y2 - y1) * 0.20))
            cx1 = max(0, x1 - pad_x)
            cy1 = max(0, y1 - pad_y)
            cx2 = min(w, x2 + pad_x)
            cy2 = min(h, y2 + pad_y)

            if cx2 <= cx1 or cy2 <= cy1:
                continue

            crop = img[cy1:cy2, cx1:cx2]
            if crop.size == 0:
                continue

            crops.append(crop)
            crop_map.append(idx)

        if not crops:
            return

        print(f"[PaddleOCR] Recognizing {len(crops)} detected lines...")
        start = time.time()

        for batch_start in range(0, len(crops), REC_BATCH_SIZE):
            batch_end = min(batch_start + REC_BATCH_SIZE, len(crops))
            batch_crops = crops[batch_start:batch_end]
            batch_indices = crop_map[batch_start:batch_end]
            batch_start_time = time.time()

            print(
                f"[PaddleOCR] Recognition batch {batch_start // REC_BATCH_SIZE + 1}: "
                f"items={len(batch_crops)}"
            )

            results = recognizer.predict(batch_crops)

            for line_index, rec in zip(batch_indices, results):
                text = rec.get("rec_text", "") if hasattr(rec, "get") else ""
                score = float(rec.get("rec_score", 0.0)) if hasattr(rec, "get") else 0.0
                if score >= REC_SCORE_THRESHOLD and text.strip():
                    lines[line_index]["text"] = text.strip()
                    lines[line_index]["confidence"] = min(
                        1.0, (lines[line_index]["confidence"] + score) / 2
                    )

            batch_elapsed = time.time() - batch_start_time
            print(
                f"[PaddleOCR] Recognition batch {batch_start // REC_BATCH_SIZE + 1} "
                f"done in {batch_elapsed:.2f}s"
            )

        elapsed = time.time() - start
        print(f"[PaddleOCR] Recognition done in {elapsed:.2f}s")

    def _merge_overlapping(self, results):
        """Merge overlapping OCR results."""
        if not results:
            return []

        sorted_results = sorted(results, key=lambda x: x["bbox"][1])
        merged = []
        used = set()

        for i, r1 in enumerate(sorted_results):
            if i in used:
                continue

            best = r1.copy()
            used.add(i)

            for j, r2 in enumerate(sorted_results):
                if j in used or j == i:
                    continue
                if self._should_merge_lines(best, r2):
                    used.add(j)
                    best = self._combine_line_entries(best, r2)

            merged.append(best)

        return merged

    def _should_merge_lines(self, first, second):
        overlap = self._bbox_overlap_metrics(first["bbox"], second["bbox"])
        max_center_gap = max(16.0, overlap["min_height"] * DUPLICATE_CENTER_GAP_RATIO)
        strong_duplicate_geometry = (
            overlap["min_area_overlap_ratio"] >= DUPLICATE_MIN_AREA_STRICT_RATIO
            and overlap["center_gap_y"] <= max_center_gap
            and overlap["height_ratio"] >= DUPLICATE_HEIGHT_RATIO
        )

        same_text_prefix = (
            bool(first.get("text"))
            and bool(second.get("text"))
            and first["text"].lower()[:10] == second["text"].lower()[:10]
        )

        if strong_duplicate_geometry:
            return True

        if (
            same_text_prefix
            and overlap["iou"] >= DUPLICATE_IOU_RATIO
            and overlap["x_overlap_ratio"] >= 0.45
            and overlap["center_gap_y"] <= max_center_gap
            and overlap["height_ratio"] >= DUPLICATE_HEIGHT_RATIO
        ):
            return True

        if (
            same_text_prefix
            and overlap["min_area_overlap_ratio"] >= DUPLICATE_OVERLAP_RATIO
            and overlap["center_gap_y"] <= max_center_gap
        ):
            return True

        if (
            {first.get("source"), second.get("source")} == {"segment", "full_page_rescue"}
            and overlap["x_overlap_ratio"] >= 0.35
            and overlap["center_gap_y"] <= max(BOUNDARY_RESCUE_MARGIN * 0.35, max_center_gap)
            and (same_text_prefix or strong_duplicate_geometry)
        ):
            return True

        if (
            same_text_prefix
            and overlap["x_overlap"] > 0
            and overlap["y_overlap"] > 10
            and overlap["center_gap_y"] <= max_center_gap
        ):
            return True

        return False

    def _combine_line_entries(self, first, second):
        combined = first.copy()

        x1_1, y1_1, x2_1, y2_1 = first["bbox"]
        x1_2, y1_2, x2_2, y2_2 = second["bbox"]
        combined["bbox"] = (
            min(x1_1, x1_2),
            min(y1_1, y1_2),
            max(x2_1, x2_2),
            max(y2_1, y2_2),
        )

        first_text = (first.get("text") or "").strip()
        second_text = (second.get("text") or "").strip()
        if len(second_text) > len(first_text):
            combined["text"] = second_text
        else:
            combined["text"] = first_text

        combined["confidence"] = max(first.get("confidence", 0.0), second.get("confidence", 0.0))

        if second.get("confidence", 0.0) > first.get("confidence", 0.0):
            combined["poly"] = second.get("poly", first.get("poly", []))

        combined["source"] = (
            "full_page_rescue"
            if "full_page_rescue" in {first.get("source"), second.get("source")}
            else first.get("source", "segment")
        )
        combined["segment_index"] = min(first.get("segment_index", 0), second.get("segment_index", 0))
        combined["segment_start"] = min(first.get("segment_start", combined["bbox"][1]), second.get("segment_start", combined["bbox"][1]))
        combined["segment_end"] = max(first.get("segment_end", combined["bbox"][3]), second.get("segment_end", combined["bbox"][3]))
        return combined

    def _bbox_overlap_metrics(self, box1, box2):
        x1_1, y1_1, x2_1, y2_1 = box1
        x1_2, y1_2, x2_2, y2_2 = box2

        x_overlap = max(0, min(x2_1, x2_2) - max(x1_1, x1_2))
        y_overlap = max(0, min(y2_1, y2_2) - max(y1_1, y1_2))
        overlap_area = x_overlap * y_overlap

        width1 = max(1, x2_1 - x1_1)
        width2 = max(1, x2_2 - x1_2)
        height1 = max(1, y2_1 - y1_1)
        height2 = max(1, y2_2 - y1_2)
        area1 = width1 * height1
        area2 = width2 * height2
        union = max(1, area1 + area2 - overlap_area)
        vertical_gap = max(0, max(y1_1, y1_2) - min(y2_1, y2_2))
        center_y1 = (y1_1 + y2_1) / 2.0
        center_y2 = (y1_2 + y2_2) / 2.0

        return {
            "x_overlap": x_overlap,
            "y_overlap": y_overlap,
            "x_overlap_ratio": x_overlap / max(1, min(width1, width2)),
            "vertical_gap": vertical_gap,
            "iou": overlap_area / union,
            "min_area_overlap_ratio": overlap_area / max(1, min(area1, area2)),
            "center_gap_y": abs(center_y1 - center_y2),
            "height_ratio": min(height1, height2) / max(height1, height2),
            "min_height": min(height1, height2),
        }

    def _group_into_bubbles(self, lines):
        """Group lines into speech bubbles."""
        if not lines:
            return []

        vertical_threshold = 80
        horizontal_threshold = 150

        sorted_lines = sorted(lines, key=lambda x: (x["bbox"][1], x["bbox"][0]))
        bubbles = []
        used = set()

        for i, line in enumerate(sorted_lines):
            if i in used:
                continue

            bubble_lines = [line]
            used.add(i)

            for j, other in enumerate(sorted_lines):
                if j in used:
                    continue

                for base_line in bubble_lines:
                    bx1, by1, bx2, by2 = base_line["bbox"]
                    ox1, oy1, ox2, oy2 = other["bbox"]

                    vertical_dist = abs(oy1 - by2)
                    horizontal_overlap = min(bx2, ox2) - max(bx1, ox1)

                    if vertical_dist < vertical_threshold and horizontal_overlap > -horizontal_threshold:
                        bubble_lines.append(other)
                        used.add(j)
                        break

            all_x1 = min(l["bbox"][0] for l in bubble_lines)
            all_y1 = min(l["bbox"][1] for l in bubble_lines)
            all_x2 = max(l["bbox"][2] for l in bubble_lines)
            all_y2 = max(l["bbox"][3] for l in bubble_lines)

            combined_text = " ".join(l["text"] for l in bubble_lines if l["text"]).strip()
            avg_conf = sum(l["confidence"] for l in bubble_lines) / len(bubble_lines)
            line_bboxes = [l["bbox"] for l in bubble_lines]

            bubbles.append(
                {
                    "bbox": (all_x1, all_y1, all_x2, all_y2),
                    "text": combined_text,
                    "confidence": avg_conf,
                    "line_count": len(bubble_lines),
                    "line_bboxes": line_bboxes,
                }
            )

        return bubbles

    def _to_api_format(self, bubbles):
        """Convert to API response format."""
        result = []
        for i, bubble in enumerate(bubbles):
            x1, y1, x2, y2 = bubble["bbox"]
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
            rx, ry = (x2 - x1) / 2 + 10, (y2 - y1) / 2 + 10

            line_boxes = []
            for lx1, ly1, lx2, ly2 in bubble.get("line_bboxes", []):
                line_boxes.append(
                    {
                        "x": lx1,
                        "y": ly1,
                        "width": lx2 - lx1,
                        "height": ly2 - ly1,
                    }
                )

            result.append(
                {
                    "id": i + 1,
                    "left": cx - rx,
                    "top": cy - ry,
                    "rx": rx,
                    "ry": ry,
                    "cx": cx,
                    "cy": cy,
                    "text": bubble["text"],
                    "confidence": round(bubble["confidence"], 2),
                    "lineCount": bubble.get("line_count", 1),
                    "lineBoxes": line_boxes,
                    "bbox": [
                        [x1, y1],
                        [x2, y1],
                        [x2, y2],
                        [x1, y2],
                    ],
                }
            )

        return result


paddle_detector = PaddleBubbleDetector()

print("[P_ocr] Pre-loading PaddleOCR models...")
print(
    f"[P_ocr] Runtime mode: {RUNTIME_MODE} "
    f"(device={DEFAULT_OCR_DEVICE}, gpu_overlay={RUNTIME_META['gpu_overlay_available']})"
)
try:
    paddle_detector.initialize("en")
    print("[P_ocr] Models loaded! Ready for fast requests!")
except Exception as e:
    print(f"[P_ocr] Pre-load failed: {e}")
