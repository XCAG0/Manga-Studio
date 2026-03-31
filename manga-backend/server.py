"""
Manga OCR Server - Flask Backend
==================================
Provides OCR, Translation, and Text Removal services for Manga Studio.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import base64
import time
import warnings
import cv2
import numpy as np
from pathlib import Path
from io import BytesIO


try:
    from markupsafe import escape
except ImportError as e:
    print(f"[CRITICAL] MarkupSafe broken: {e}", flush=True)
    import sys
    sys.exit(1)
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

try:
    from requests import RequestsDependencyWarning

    warnings.filterwarnings("ignore", category=RequestsDependencyWarning)
except Exception:
    pass

app = Flask(__name__)

CORS(app, origins=['http://localhost:5173', 'http://127.0.0.1:5173'])

from ocr_runtime import get_runtime_metadata
from P_ocr import paddle_detector

from translate import translation_service

LAMA_AVAILABLE = False
simple_lama = None
try:
    import torch

    numpy_major = int(np.__version__.split('.', 1)[0])
    torch_major = int(str(torch.__version__).split('.', 1)[0])

    if numpy_major >= 2 and torch_major < 2:
        print(
            f"[Server] LaMa disabled: NumPy {np.__version__} is incompatible with torch {torch.__version__}. "
            "Use numpy<2 or a newer torch build."
        )
    else:
        from simple_lama_inpainting import SimpleLama

        _lama_local = os.path.join(script_dir, 'models', 'lama', 'big-lama.pt')
        if os.path.exists(_lama_local):
            os.environ['LAMA_MODEL'] = _lama_local
        simple_lama = SimpleLama()
        LAMA_AVAILABLE = True
        print("[Server] LaMa inpainting loaded successfully!")
except ImportError:
    print("[Server] LaMa not available, will use OpenCV fallback")
except Exception as e:
    print(f"[Server] LaMa init error: {e}, will use OpenCV fallback")

@app.route('/api/health', methods=['GET'])
def health_check():
   # GET /api/health
  
    return jsonify({
        "status": "ok",
        "service": "manga-bubble-detection",
        "engines": ["paddleocr"],
        "defaultEngine": "paddleocr",
        "lama_available": LAMA_AVAILABLE,
        "ready": True,
        "ocr_runtime": get_runtime_metadata()
    })


@app.route('/api/detect-bubbles', methods=['POST'])
def detect_bubbles():
  #  POST /api/detect-bubbles
    try:
        request_start = time.time()
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400
        
        image_b64 = data.get('image')
        
        if not image_b64:
            return jsonify({
                "success": False,
                "error": "No image provided"
            }), 400
        
        lang = data.get('lang', 'en')
        engine = data.get('engine', 'paddleocr')
        include_text = data.get('includeText', True)
        
        print(f"[Server] Detecting with engine: {engine}, lang: {lang}, include_text: {include_text}")
        
        # OCR Detection
        result = paddle_detector.detect(image_b64, lang, include_text=include_text)
        result['engine'] = 'paddleocr'
        
        total_time = time.time() - request_start
        print(f"[Timing] Total request: {total_time:.2f}s")
        
        return jsonify(result)
        
    except Exception as e:
        print(f"[Server] Error in /detect-bubbles: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/initialize', methods=['POST'])
def initialize_detector():
    try:
        data = request.get_json() or {}
        lang = data.get('lang', 'japan')
        
        paddle_detector.initialize(lang)
        
        return jsonify({
            "success": True,
            "message": f"Detector initialized with language: {lang}"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/auto-translate', methods=['POST'])
def auto_translate():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400
        
        image_b64 = data.get('image')
        source_lang = data.get('source_lang', 'japan')
        target_lang = data.get('target_lang', 'en')
        engine = data.get('engine', 'paddleocr')
        
        if not image_b64:
            return jsonify({
                "success": False,
                "error": "No image provided"
            }), 400
        
        print(f"[AutoTranslate] {source_lang} -> {target_lang}")
        
        detect_result = paddle_detector.detect(image_b64, source_lang, include_text=True)
        
        if not detect_result.get('success'):
            return jsonify(detect_result)
        
        bubbles = detect_result.get('bubbles', [])
        
        translated_bubbles = translation_service.translate_bubbles(
            bubbles, 
            source_lang=source_lang, 
            target_lang=target_lang
        )
        
        return jsonify({
            "success": True,
            "bubbles": translated_bubbles,
            "count": len(translated_bubbles),
            "source_lang": source_lang,
            "target_lang": target_lang,
            "engine": engine,
            "processingTime": detect_result.get('processingTime', 0)
        })
        
    except Exception as e:
        print(f"[AutoTranslate] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


def decode_base64_image(image_b64):
    if ',' in image_b64:
        image_b64 = image_b64.split(',', 1)[1]

    img_bytes = base64.b64decode(image_b64)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Failed to decode image")
    return image


def encode_image_to_data_url(image):
    ok, buffer = cv2.imencode('.png', image)
    if not ok:
        raise ValueError("Failed to encode image")
    result_b64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/png;base64,{result_b64}"


def to_float(val):
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        return float(val.replace(',', '.').strip())
    return float(val)


def parse_bbox_bounds(bbox):
    if isinstance(bbox, list) and len(bbox) >= 3 and isinstance(bbox[0], list):
        x1 = int(min(to_float(p[0]) for p in bbox))
        y1 = int(min(to_float(p[1]) for p in bbox))
        x2 = int(max(to_float(p[0]) for p in bbox))
        y2 = int(max(to_float(p[1]) for p in bbox))
    elif isinstance(bbox, list) and len(bbox) >= 8 and not isinstance(bbox[0], list):
        coords = [to_float(b) for b in bbox]
        x_coords = [coords[i] for i in range(0, len(coords), 2)]
        y_coords = [coords[i] for i in range(1, len(coords), 2)]
        x1 = int(min(x_coords))
        y1 = int(min(y_coords))
        x2 = int(max(x_coords))
        y2 = int(max(y_coords))
    elif isinstance(bbox, list) and len(bbox) == 4 and not isinstance(bbox[0], list):
        coords = [to_float(b) for b in bbox]
        x1, y1, x2, y2 = int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3])
    else:
        raise ValueError(f"Invalid bbox format: {bbox}")

    if x1 > x2:
        x1, x2 = x2, x1
    if y1 > y2:
        y1, y2 = y2, y1

    return x1, y1, x2, y2


DEFAULT_MAGIC_OPTIONS = {
    "padding": 10,
    "mask_mode": "hybrid",
    "mask_expand_x": 3,
    "mask_expand_y": 4,
    "dilate_kernel": 5,
    "dilate_iterations": 2,
    "inpaint_engine": "auto",
    "opencv_radius": 3,
}


def analyze_cleanup_region(image_crop, line_boxes=None):
    if image_crop is None or image_crop.size == 0:
        return {
            "panel_like": False,
            "blue_ratio": 0.0,
            "edge_density": 0.0,
            "line_box_count": len(line_boxes or []),
        }

    hsv = cv2.cvtColor(image_crop, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image_crop, cv2.COLOR_BGR2GRAY)

    hue = hsv[:, :, 0]
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    valid = (sat >= 45) & (val >= 60)
    blue_like = valid & (hue >= 78) & (hue <= 112)
    blue_ratio = float(np.count_nonzero(blue_like)) / float(max(1, image_crop.shape[0] * image_crop.shape[1]))

    edges = cv2.Canny(gray, 90, 180)
    edge_density = float(np.count_nonzero(edges)) / float(max(1, edges.size))
    line_box_count = len(line_boxes or [])

    panel_like = blue_ratio >= 0.15 and line_box_count >= 3
    if blue_ratio >= 0.26 and image_crop.shape[0] * image_crop.shape[1] >= 50000:
        panel_like = True

    return {
        "panel_like": panel_like,
        "blue_ratio": round(blue_ratio, 4),
        "edge_density": round(edge_density, 4),
        "line_box_count": line_box_count,
    }


def sanitize_magic_options(raw_options=None, fallback_padding=10):
    options = dict(DEFAULT_MAGIC_OPTIONS)
    options["padding"] = max(1, min(int(fallback_padding), 50))

    if not isinstance(raw_options, dict):
        return options

    if "padding" in raw_options:
        options["padding"] = max(1, min(int(to_float(raw_options.get("padding", options["padding"]))), 50))

    mask_mode = str(raw_options.get("maskMode", raw_options.get("mask_mode", options["mask_mode"]))).strip().lower()
    if mask_mode in {"hybrid", "line_boxes", "bubble_bbox"}:
        options["mask_mode"] = mask_mode

    options["mask_expand_x"] = max(
        0,
        min(int(to_float(raw_options.get("maskExpandX", raw_options.get("mask_expand_x", options["mask_expand_x"])))), 24),
    )
    options["mask_expand_y"] = max(
        0,
        min(int(to_float(raw_options.get("maskExpandY", raw_options.get("mask_expand_y", options["mask_expand_y"])))), 24),
    )

    dilate_kernel = max(
        1,
        min(int(to_float(raw_options.get("dilateKernel", raw_options.get("dilate_kernel", options["dilate_kernel"])))), 15),
    )
    options["dilate_kernel"] = dilate_kernel if dilate_kernel % 2 == 1 else dilate_kernel + 1
    options["dilate_iterations"] = max(
        0,
        min(int(to_float(raw_options.get("dilateIterations", raw_options.get("dilate_iterations", options["dilate_iterations"])))), 6),
    )

    inpaint_engine = str(
        raw_options.get("inpaintEngine", raw_options.get("inpaint_engine", options["inpaint_engine"]))
    ).strip().lower()
    if inpaint_engine in {"auto", "lama", "opencv"}:
        options["inpaint_engine"] = inpaint_engine

    options["opencv_radius"] = max(
        1,
        min(int(to_float(raw_options.get("opencvRadius", raw_options.get("opencv_radius", options["opencv_radius"])))), 12),
    )

    return options


def build_text_mask(crop_w, crop_h, crop_x1, crop_y1, x1, y1, x2, y2, line_boxes=None, magic_options=None):
    mask = np.zeros((crop_h, crop_w), dtype=np.uint8)
    magic = sanitize_magic_options(magic_options)
    mask_mode = magic["mask_mode"]
    expand_x = magic["mask_expand_x"]
    expand_y = magic["mask_expand_y"]
    used_line_boxes = False

    if line_boxes and mask_mode in {"hybrid", "line_boxes"}:
        for lb in line_boxes:
            lx = int(to_float(lb.get('x', 0))) - crop_x1 - expand_x
            ly = int(to_float(lb.get('y', 0))) - crop_y1 - expand_y
            lw = int(to_float(lb.get('width', 0))) + (expand_x * 2)
            lh = int(to_float(lb.get('height', 0))) + (expand_y * 2)

            lx = max(0, lx)
            ly = max(0, ly)
            lx2 = min(crop_w, lx + lw)
            ly2 = min(crop_h, ly + lh)

            if lx2 > lx and ly2 > ly:
                cv2.rectangle(mask, (lx, ly), (lx2, ly2), 255, -1)
                used_line_boxes = True

    if mask_mode == "bubble_bbox" or not used_line_boxes:
        rel_x1 = x1 - crop_x1
        rel_y1 = y1 - crop_y1
        rel_x2 = x2 - crop_x1
        rel_y2 = y2 - crop_y1
        cv2.rectangle(mask, (rel_x1, rel_y1), (rel_x2, rel_y2), 255, -1)

    if magic["dilate_iterations"] > 0:
        kernel = np.ones((magic["dilate_kernel"], magic["dilate_kernel"]), np.uint8)
        mask = cv2.dilate(mask, kernel, iterations=magic["dilate_iterations"])

    return mask


def inpaint_crop_region(cropped_image, mask, magic_options=None):
    magic = sanitize_magic_options(magic_options)
    crop_h, crop_w = cropped_image.shape[:2]
    min_lama_size = 16
    use_lama = (
        magic["inpaint_engine"] != "opencv"
        and LAMA_AVAILABLE
        and crop_w >= min_lama_size
        and crop_h >= min_lama_size
    )

    if use_lama:
        from PIL import Image

        image_rgb = cv2.cvtColor(cropped_image, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(image_rgb)
        pil_mask = Image.fromarray(mask)

        try:
            result_pil = simple_lama(pil_image, pil_mask)
            result = cv2.cvtColor(np.array(result_pil), cv2.COLOR_RGB2BGR)
            if result.shape[:2] != (crop_h, crop_w):
                result = cv2.resize(result, (crop_w, crop_h))
            return result, "lama"
        except Exception as exc:
            print(f"[Remove Text] LaMa error: {exc}")

    return cv2.inpaint(cropped_image, mask, magic["opencv_radius"], cv2.INPAINT_TELEA), "opencv"


def blend_cleaned_crop(original_crop, cleaned_crop, mask, content_profile=None):
    if original_crop.shape[:2] != cleaned_crop.shape[:2]:
        cleaned_crop = cv2.resize(cleaned_crop, (original_crop.shape[1], original_crop.shape[0]))

    if mask is None or mask.size == 0:
        return cleaned_crop

    if not np.any(mask):
        return original_crop.copy()

    profile = content_profile or {}
    sigma = 4.0 if profile.get("panel_like") else 2.5
    alpha = cv2.GaussianBlur(mask.astype(np.float32) / 255.0, (0, 0), sigmaX=sigma, sigmaY=sigma)
    alpha = np.clip(alpha * (1.2 if profile.get("panel_like") else 1.35), 0.0, 1.0)
    alpha_3 = alpha[:, :, None]

    blended = (
        cleaned_crop.astype(np.float32) * alpha_3
        + original_crop.astype(np.float32) * (1.0 - alpha_3)
    )
    return blended.clip(0, 255).astype(np.uint8)


def apply_cleanup_to_bbox(full_image, bbox, padding=10, line_boxes=None, edit_mode="magic_cleaner", magic_options=None):
    img_h, img_w = full_image.shape[:2]
    x1, y1, x2, y2 = parse_bbox_bounds(bbox)
    magic = sanitize_magic_options(magic_options, fallback_padding=padding)

    if x2 - x1 < 1 or y2 - y1 < 1:
        raise ValueError(f"Bbox too small: {x2 - x1}x{y2 - y1}")

    x1 = max(0, min(x1, img_w - 1))
    y1 = max(0, min(y1, img_h - 1))
    x2 = max(1, min(x2, img_w))
    y2 = max(1, min(y2, img_h))

    preview_padding = magic["padding"]
    preview_x1 = max(0, x1 - preview_padding)
    preview_y1 = max(0, y1 - preview_padding)
    preview_x2 = min(img_w, x2 + preview_padding)
    preview_y2 = min(img_h, y2 + preview_padding)
    preview_crop = full_image[preview_y1:preview_y2, preview_x1:preview_x2]
    content_profile = analyze_cleanup_region(preview_crop, line_boxes)

    padding = magic["padding"]
    if edit_mode == "magic_cleaner" and content_profile.get("panel_like"):
        padding = max(padding, 28)

    crop_x1 = max(0, x1 - padding)
    crop_y1 = max(0, y1 - padding)
    crop_x2 = min(img_w, x2 + padding)
    crop_y2 = min(img_h, y2 + padding)

    crop_w = crop_x2 - crop_x1
    crop_h = crop_y2 - crop_y1
    if crop_w <= 0 or crop_h <= 0:
        raise ValueError(f"Invalid crop dimensions: {crop_w}x{crop_h}")

    cropped_image = full_image[crop_y1:crop_y2, crop_x1:crop_x2].copy()
    mask = build_text_mask(crop_w, crop_h, crop_x1, crop_y1, x1, y1, x2, y2, line_boxes, magic)

    if edit_mode == "clean_white_bb":
        cleaned_crop = cropped_image.copy()
        cleaned_crop[mask > 0] = (255, 255, 255)
        engine_used = "white_fill"
        blended_crop = cleaned_crop
    else:
        cleaned_crop, engine_used = inpaint_crop_region(cropped_image, mask, magic)
        blended_crop = blend_cleaned_crop(cropped_image, cleaned_crop, mask, content_profile)

    result = full_image.copy()
    result[crop_y1:crop_y2, crop_x1:crop_x2] = blended_crop

    return result, {
        "engine": engine_used,
        "region_size": f"{crop_w}x{crop_h}",
        "magic_options": magic,
        "content_profile": content_profile,
    }


@app.route('/api/remove-text-bbox', methods=['POST'])
def remove_text_bbox():

    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400

        image_b64 = data.get('image')
        bbox = data.get('bbox')
        padding = data.get('padding', 10)
        line_boxes = data.get('lineBoxes')
        magic_options = data.get('magicOptions')

        if not image_b64 or not bbox:
            return jsonify({"success": False, "error": "Missing image or bbox"}), 400

        full_image = decode_base64_image(image_b64)
        result_image, meta = apply_cleanup_to_bbox(
            full_image,
            bbox,
            padding=padding,
            line_boxes=line_boxes,
            edit_mode="magic_cleaner",
            magic_options=magic_options,
        )

        return jsonify({
            "success": True,
            "image": encode_image_to_data_url(result_image),
            "engine": meta["engine"],
            "region_size": meta["region_size"],
            "magic_options": meta["magic_options"],
        })
    except Exception as e:
        print(f"[Remove Text] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/apply-bubble-edit', methods=['POST'])
def apply_bubble_edit():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400

        image_b64 = data.get('image')
        bubbles = data.get('bubbles') or []
        edit_mode = data.get('editMode', 'magic_cleaner')
        padding = data.get('padding', 10)
        magic_options = data.get('magicOptions')

        if not image_b64:
            return jsonify({"success": False, "error": "Missing image"}), 400

        working_image = decode_base64_image(image_b64)
        processed_count = 0
        last_engine = "white_fill" if edit_mode == "clean_white_bb" else ("lama" if LAMA_AVAILABLE else "opencv")
        last_region = None
        started = time.time()

        for bubble in bubbles:
            bbox = bubble.get('bbox')
            if not bbox:
                continue

            line_boxes = bubble.get('lineBoxes') or []
            working_image, meta = apply_cleanup_to_bbox(
                working_image,
                bbox,
                padding=padding,
                line_boxes=line_boxes,
                edit_mode=edit_mode,
                magic_options=magic_options,
            )
            processed_count += 1
            last_engine = meta["engine"]
            last_region = meta["region_size"]

        return jsonify({
            "success": True,
            "image": encode_image_to_data_url(working_image),
            "count": processed_count,
            "engine": last_engine,
            "region_size": last_region,
            "edit_mode": edit_mode,
            "magic_options": meta["magic_options"] if processed_count else sanitize_magic_options(magic_options, fallback_padding=padding),
            "processingTime": round(time.time() - started, 2),
        })
    except Exception as e:
        print(f"[Bubble Edit] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    port = 5000
    
    print("=" * 50)
    print("  Manga Text Detection Server")
    print("=" * 50)
    print(f"  Port: {port}")
    print(f"  PaddleOCR: Enabled")
    print(f"  LaMa Inpainting: {'Enabled' if LAMA_AVAILABLE else 'Disabled (OpenCV fallback)'}")
    print(f"  Translation: Enabled")
    print("=" * 50)
    print(f"  Server running at: http://localhost:{port}")
    print(f"  Health check: http://localhost:{port}/api/health")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=port, debug=False)
