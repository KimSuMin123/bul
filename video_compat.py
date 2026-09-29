# -*- coding: utf-8 -*-
"""
세화붓다아카데미 - 모든 기기에서 재생되는 웹 강의 영상 인코딩 설정 (공통 모듈)

일부 기기에서 '소리만 나오고 화면이 안 나오는' 문제를 막기 위해 항상 다음 형식으로 만듭니다.
- H.264 High 프로필, Level 4.0 (1080p 30fps까지 거의 모든 폰·PC 하드웨어 디코더가 지원)
- 색 형식 yuv420p, TV(limited) 색 범위, BT.709 색 정보 (JPEG용 yuvj420p 금지)
- 정사각 픽셀(SAR 1:1), 표준 해상도 1920x1080 또는 1280x720 (비율이 다르면 여백으로 맞춤)
- 고정 30fps (녹화 원본의 불규칙한 프레임 간격 제거)
- AAC 스테레오 64kbps, faststart
- Supabase 무료 요금제 파일당 50MB 한도 → 45MB 이하가 될 때까지 단계적으로 낮춰 재압축
"""

import os
import re
import subprocess
from pathlib import Path

SIZE_LIMIT_MB = 45.0

# (높이, CRF) 순서로 시도: 1080p → 720p → 720p 저용량
ATTEMPTS = [(1080, 28), (720, 28), (720, 31)]


def build_cmd(ffmpeg, src, dst, height, crf):
    width = 1920 if height == 1080 else 1280
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos"
        f":out_range=tv:out_color_matrix=bt709,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p"
    )
    return [
        ffmpeg, "-y", "-i", str(src),
        "-vf", vf,
        "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.0",
        "-pix_fmt", "yuv420p", "-color_range", "tv",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-crf", str(crf), "-preset", "veryfast", "-g", "150",
        "-c:a", "aac", "-b:a", "64k", "-ac", "2", "-ar", "44100",
        "-movflags", "+faststart",
        str(dst),
    ]


def media_duration(ffmpeg, src):
    """원본 길이(초). 알 수 없으면 0."""
    info = subprocess.run([ffmpeg, "-hide_banner", "-i", str(src)], capture_output=True,
                          text=True, encoding="utf-8", errors="replace").stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0.0


def run_with_progress(cmd, duration, on_progress=None):
    """ffmpeg를 실행하며 진행률(0~100)을 on_progress로 알린다."""
    cmd = cmd[:-1] + ["-progress", "pipe:1", "-nostats", cmd[-1]]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    for line in proc.stdout:
        if on_progress and duration and line.startswith("out_time_us="):
            try:
                on_progress(min(99.9, int(line.split("=", 1)[1]) / 1e6 / duration * 100))
            except ValueError:
                pass
    if proc.wait() != 0:
        raise subprocess.CalledProcessError(proc.returncode, cmd)


def encode_under_limit(ffmpeg, src, dst, limit_mb=SIZE_LIMIT_MB, log=print, on_progress=None):
    """원본을 호환 형식으로 인코딩하고 limit_mb 이하가 되는 첫 결과를 dst에 남긴다. (크기MB, 높이) 반환.
    on_progress(퍼센트, 높이) 가 있으면 인코딩 진행률을 알린다."""
    src, dst = Path(src), Path(dst)
    tmp = dst.with_name(f"temp_{dst.name}")
    duration = media_duration(ffmpeg, src)
    for height, crf in ATTEMPTS:
        run_with_progress(build_cmd(ffmpeg, src, tmp, height, crf), duration,
                          (lambda pct, h=height: on_progress(pct, h)) if on_progress else None)
        size_mb = os.path.getsize(tmp) / (1024 * 1024)
        if size_mb <= limit_mb or (height, crf) == ATTEMPTS[-1]:
            if dst.exists():
                dst.unlink()
            tmp.rename(dst)
            if size_mb > limit_mb:
                log(f"[경고] 최저 설정으로도 {size_mb:.1f}MB로 {limit_mb:.0f}MB를 넘습니다: {dst.name}")
            return size_mb, height
        log(f"   {height}p CRF {crf} 결과 {size_mb:.1f}MB > {limit_mb:.0f}MB → 다음 설정으로 재압축")
    raise RuntimeError("unreachable")


def probe(ffmpeg, path):
    """영상 스트림의 프로필·레벨·색 형식·해상도·픽셀 비율·fps를 읽어 호환 여부를 판정한다."""
    info = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path)], capture_output=True,
                          text=True, encoding="utf-8", errors="replace").stderr
    headers = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path), "-c", "copy", "-bsf:v", "trace_headers",
                              "-frames:v", "1", "-f", "null", "-"], capture_output=True,
                             text=True, encoding="utf-8", errors="replace").stderr
    line = next((l for l in info.splitlines() if "Video:" in l), "")
    level = re.search(r"\blevel_idc\s+\S+\s*=\s*(\d+)", headers)
    result = {
        "codec": "h264" if "Video: h264" in line else line.split("Video:")[-1].split()[0] if line else "?",
        "profile": (re.search(r"Video: h264 \(([^)]*)\)", line) or [None, "?"])[1],
        "level": int(level.group(1)) if level else None,
        "pix_fmt": (re.search(r"\), (yuvj?\d+p\w*)", line) or [None, "?"])[1],
        "size": (re.search(r"(\d{3,4}x\d{3,4})", line) or [None, "?"])[1],
        "sar": (re.search(r"SAR (\d+:\d+)", line) or [None, "1:1"])[1],
        "fps": (re.search(r"([\d.]+) fps", line) or [None, "?"])[1],
        "audio": "aac" if "Audio: aac" in info else "?",
    }
    result["ok"] = (result["codec"] == "h264" and result["profile"] in ("High", "Main", "Constrained Baseline")
                    and result["level"] is not None and result["level"] <= 40
                    and result["pix_fmt"] == "yuv420p" and result["size"] in ("1920x1080", "1280x720")
                    and result["sar"] == "1:1" and result["fps"] in ("30", "30.00") and result["audio"] == "aac")
    return result
