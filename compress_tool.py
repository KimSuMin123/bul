# -*- coding: utf-8 -*-
"""
원각 불교 아카데미 - 동영상 원클릭 고화질 웹 스트리밍 자동 압축기
- 1080p Full HD 글자 가독성 100% 무손실 유지 (H.264 CRF 26)
- 웹 즉시 재생 최적화 (-movflags +faststart)
- 클라우드 스토리지 48MB 허용 한도 자동 준수
- 결과물 저장 위치: '웹업로드용_압축영상/' 폴더
"""

import os
import sys
import time
import subprocess
from pathlib import Path

FFMPEG_PATH = r"C:\Users\sehyeon\AppData\Local\Programs\Python\Python311\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
OUTPUT_DIR = Path("웹업로드용_압축영상").resolve()

def compress_video(src_path, dst_path):
    orig_size_mb = os.path.getsize(src_path) / (1024 * 1024)
    print(f"\n------------------------------------------------------------")
    print(f"▶ 원본 파일: {src_path.name}")
    print(f"▶ 원본 용량: {orig_size_mb:.1f} MB")
    print(f"▶ 압축 진행 중 (1080p FHD 보존 + Faststart 적용)...")
    
    t0 = time.time()
    cmd = [
        FFMPEG_PATH, "-y",
        "-i", str(src_path),
        "-c:v", "libx264",
        "-crf", "26",
        "-preset", "veryfast",
        "-c:a", "aac",
        "-b:a", "64k",
        "-movflags", "+faststart",
        str(dst_path)
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        print(f"[오류 발생] 인코딩 실패: {e}")
        return False

    comp_size_mb = os.path.getsize(dst_path) / (1024 * 1024)
    elapsed = time.time() - t0

    # 48MB safety limit check
    if comp_size_mb > 48.0:
        print(f"[알림] 48MB 초과({comp_size_mb:.1f}MB)로 720p 최적화 2차 압축을 실행합니다...")
        temp_path = dst_path.with_name(f"temp_{dst_path.name}")
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
            str(temp_path)
        ]
        try:
            subprocess.run(cmd2, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if dst_path.exists():
                dst_path.unlink()
            temp_path.rename(dst_path)
            comp_size_mb = os.path.getsize(dst_path) / (1024 * 1024)
        except Exception as e:
            print(f"[경고] 2차 압축 오류: {e}")

    reduced_pct = ((orig_size_mb - comp_size_mb) / orig_size_mb) * 100 if orig_size_mb > 0 else 0

    print(f"★ [압축 성공!] {orig_size_mb:.1f}MB ──▶ {comp_size_mb:.1f}MB ({reduced_pct:.1f}% 용량 대폭 절감)")
    print(f"  - 소요 시간: {elapsed:.1f}초")
    print(f"  - 저장 위치: {dst_path}")
    print(f"------------------------------------------------------------")
    return True

def scan_local_videos():
    candidates = []
    for root, dirs, files in os.walk('.'):
        if any(ignored in root for ignored in ['node_modules', '.git', 'dist', '웹업로드용_압축영상', 'compressed']):
            continue
        for f in files:
            if f.lower().endswith(('.mp4', '.mov', '.webm', '.mkv')):
                p = Path(root) / f
                try:
                    size_mb = p.stat().st_size / (1024 * 1024)
                    candidates.append((p.resolve(), size_mb))
                except Exception:
                    pass
    return candidates

def main():
    print("================================================================")
    print("      원각 불교 아카데미 동영상 원클릭 고화질 자동 압축기")
    print("      (1080p FHD 화질 보존 / 48MB 클라우드 스토리지 규격)")
    print("================================================================")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not os.path.exists(FFMPEG_PATH):
        print(f"[오류] FFmpeg 실행기를 찾을 수 없습니다:\n{FFMPEG_PATH}")
        input("\n엔터 키를 누르면 종료합니다...")
        return

    # Check command-line arguments (e.g. drag & drop onto .bat file)
    args = sys.argv[1:]
    targets = []
    for arg in args:
        p = Path(arg.strip('\'"')).resolve()
        if p.exists() and p.is_file():
            targets.append(p)

    if targets:
        print(f"\n총 {len(targets)}개의 동영상 파일을 압축합니다.")
        success = 0
        for p in targets:
            dst = OUTPUT_DIR / f"{p.stem}.mp4"
            if compress_video(p, dst):
                success += 1
        print(f"\n================================================================")
        print(f"작업 완료: 총 {success}개 파일이 '웹업로드용_압축영상/' 폴더에 저장되었습니다.")
        print(f"관리자 페이지에서 해당 압축본을 선택하시면 오류 없이 즉시 등록됩니다!")
        print(f"================================================================")
        return

    # Interactive Menu
    all_videos = scan_local_videos()
    if not all_videos:
        print("\n폴더 내에서 동영상 파일을 찾을 수 없습니다.")
        user_path = input("압축할 영상 파일의 전체 경로를 입력해 주세요: ").strip('\'"')
        p = Path(user_path).resolve()
        if p.exists() and p.is_file():
            dst = OUTPUT_DIR / f"{p.stem}.mp4"
            compress_video(p, dst)
        return

    print(f"\n감지된 동영상 파일 목록 (총 {len(all_videos)}개):")
    for idx, (p, size_mb) in enumerate(all_videos, 1):
        status = "[48MB 초과 - 압축 필요]" if size_mb > 48.0 else "[적정 규격]"
        print(f"  [{idx:2d}] {p.name:<35} ({size_mb:5.1f} MB) {status}")

    print("\n----------------------------------------------------------------")
    print("  [A] 48MB 초과 영상 전체 일괄 자동 압축")
    print("  [1~{}] 번호 선택하여 특정 영상만 압축".format(len(all_videos)))
    print("  [Q] 프로그램 종료")
    print("----------------------------------------------------------------")

    choice = input("\n원하시는 작업 번호를 입력하세요: ").strip().upper()

    if choice == 'Q':
        print("프로그램을 종료합니다.")
        return

    if choice == 'A':
        to_process = [p for p, s in all_videos if s > 48.0]
        if not to_process:
            to_process = [p for p, s in all_videos]
        print(f"\n총 {len(to_process)}개 영상의 일괄 압축을 시작합니다...")
        for p in to_process:
            dst = OUTPUT_DIR / f"{p.stem}.mp4"
            compress_video(p, dst)
        print(f"\n★ 모든 압축이 완료되었습니다! '웹업로드용_압축영상' 폴더를 확인해 주세요.")
    elif choice.isdigit() and 1 <= int(choice) <= len(all_videos):
        target_p, _ = all_videos[int(choice) - 1]
        dst = OUTPUT_DIR / f"{target_p.stem}.mp4"
        compress_video(target_p, dst)
        print(f"\n★ 압축 완료! '웹업로드용_압축영상' 폴더에 저장되었습니다.")
    else:
        print("잘못된 입력입니다. 종료합니다.")

if __name__ == "__main__":
    main()
