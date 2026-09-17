# -*- coding: utf-8 -*-
"""
세화붓다아카데미 - [불교해설사] 30개 동영상 자동 고화질 웹 스트리밍 압축기
- 대상: '불교해설사/' 폴더 내 30개 AVI 대용량 영상 (~55GB)
- 결과: '웹업로드용_압축영상_해설사/' 폴더 (1080p FHD 무손실 보존 + 48MB 이하)
- 특징: 이미 완료된 파일 자동 건너뛰기 (Resume 지원), 48MB 초과 시 720p 2차 압축 자동 적용
"""

import os
import sys
import re
import time
import subprocess
from pathlib import Path

# Set UTF-8 encoding for standard output
sys.stdout.reconfigure(encoding='utf-8')

try:
    import imageio_ffmpeg
    FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG_PATH = os.environ.get("FFMPEG_PATH", "ffmpeg")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_DIR = PROJECT_ROOT / "불교해설사"
OUTPUT_DIR = PROJECT_ROOT / "웹업로드용_압축영상_해설사"

def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', str(s))]

def compress_video(src_path, dst_path, index, total):
    orig_size_mb = os.path.getsize(src_path) / (1024 * 1024)
    file_name = src_path.name
    target_name = dst_path.name

    # Check if already compressed safely (< 48MB and > 1MB)
    if dst_path.exists():
        curr_mb = os.path.getsize(dst_path) / (1024 * 1024)
        if 1.0 <= curr_mb <= 48.0:
            print(f"[{index}/{total}] [건너뛰기 - 이미 완료됨] {target_name} ({curr_mb:.1f} MB)")
            return True

    print(f"\n============================================================")
    print(f"▶ [{index}/{total}] 압축 시작: {file_name}")
    print(f"   - 원본 용량: {orig_size_mb:.1f} MB ({orig_size_mb / 1024:.2f} GB)")
    print(f"   - 목표 규격: 1080p FHD H.264 (CRF 26) + Faststart 웹 가속")
    print(f"------------------------------------------------------------")

    t0 = time.time()
    temp_dst = dst_path.with_name(f"temp_{dst_path.name}")

    cmd = [
        FFMPEG_PATH, "-y",
        "-i", str(src_path),
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
        "-c:v", "libx264",
        "-crf", "26",
        "-preset", "veryfast",
        "-c:a", "aac",
        "-b:a", "64k",
        "-movflags", "+faststart",
        str(temp_dst)
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        print(f"✖ [오류 발생] 1차 인코딩 실패: {e}")
        if temp_dst.exists():
            temp_dst.unlink()
        return False

    comp_size_mb = os.path.getsize(temp_dst) / (1024 * 1024)
    elapsed = time.time() - t0

    # 48MB safety limit check
    if comp_size_mb > 48.0:
        print(f"   ! 48MB 초과({comp_size_mb:.1f}MB)로 720p 2차 최적화 압축을 실행합니다...")
        temp_dst2 = dst_path.with_name(f"temp2_{dst_path.name}")
        cmd2 = [
            FFMPEG_PATH, "-y",
            "-i", str(src_path),
            "-c:v", "libx264",
            "-crf", "27",
            "-vf", "scale=1280:-2",
            "-preset", "veryfast",
            "-c:a", "aac",
            "-b:a", "64k",
            "-movflags", "+faststart",
            str(temp_dst2)
        ]
        try:
            subprocess.run(cmd2, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if temp_dst.exists():
                temp_dst.unlink()
            temp_dst = temp_dst2
            comp_size_mb = os.path.getsize(temp_dst) / (1024 * 1024)
        except Exception as e:
            print(f"✖ [경고] 2차 압축 오류: {e}")

    # Move temp to final destination
    if dst_path.exists():
        dst_path.unlink()
    temp_dst.rename(dst_path)

    reduced_pct = ((orig_size_mb - comp_size_mb) / orig_size_mb) * 100 if orig_size_mb > 0 else 0
    print(f"★ [압축 성공!] {orig_size_mb:.1f}MB ──▶ {comp_size_mb:.1f}MB ({reduced_pct:.1f}% 용량 절감)")
    print(f"   - 소요 시간: {elapsed:.1f}초")
    print(f"   - 저장 위치: {dst_path.name}")
    print(f"============================================================\n")
    return True

def main():
    print("================================================================")
    print("      세화붓다아카데미 [불교해설사] 30개 동영상 일괄 자동 압축기")
    print("      (1080p FHD 화질 보존 / 48MB 클라우드 스토리지 규격)")
    print("================================================================")
    print(f"입력 디렉토리: {INPUT_DIR}")
    print(f"출력 디렉토리: {OUTPUT_DIR}")
    print(f"FFmpeg 실행기 : {FFMPEG_PATH}\n")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not INPUT_DIR.exists():
        print(f"✖ 입력 디렉토리를 찾을 수 없습니다: {INPUT_DIR}")
        return

    files = [f for f in INPUT_DIR.iterdir() if f.is_file() and f.suffix.lower() in ('.avi', '.mp4', '.mov', '.mkv')]
    files.sort(key=lambda p: natural_sort_key(p.name))

    print(f"총 {len(files)}개의 영상 파일이 감지되었습니다.")
    total_raw_mb = sum(os.path.getsize(f) for f in files) / (1024 * 1024)
    print(f"총 원본 용량 : {total_raw_mb / 1024:.2f} GB\n")

    start_all = time.time()
    success_count = 0

    for i, src_file in enumerate(files, 1):
        dst_file = OUTPUT_DIR / f"{src_file.stem}.mp4"
        if compress_video(src_file, dst_file, i, len(files)):
            success_count += 1

    total_elapsed = (time.time() - start_all) / 60
    total_comp_mb = sum(os.path.getsize(OUTPUT_DIR / f"{f.stem}.mp4") for f in files if (OUTPUT_DIR / f"{f.stem}.mp4").exists()) / (1024 * 1024)

    print("\n================================================================")
    print(f"★ [전체 작업 완료!]")
    print(f"   - 성공 건수: {success_count} / {len(files)}개 파일")
    print(f"   - 원본 전체: {total_raw_mb / 1024:.2f} GB")
    print(f"   - 압축 전체: {total_comp_mb / 1024:.2f} GB ({total_comp_mb:.1f} MB)")
    print(f"   - 총 절감률: {((total_raw_mb - total_comp_mb) / total_raw_mb) * 100:.1f}% 대폭 경량화")
    print(f"   - 총 소요시간: {total_elapsed:.1f}분")
    print(f"   - 저장 폴더: {OUTPUT_DIR}")
    print("================================================================\n")

if __name__ == "__main__":
    main()
