# -*- coding: utf-8 -*-
"""
원본 강의 영상 60개를 모든 기기 호환 형식(video_compat.py)으로 다시 압축한다.
- 법사: 불교의례법사/*.mp4 → 웹업로드용_호환영상/법사/<같은 이름>.mp4
- 해설사: 불교해설사/*.avi → 웹업로드용_호환영상/해설사/<같은 이름>.mp4
- 이미 호환 검사를 통과한 결과는 건너뜀(중단 후 이어서 실행 가능)
- 운영 저장소는 건드리지 않음. 업로드는 별도 단계.
"""
import sys, time, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)

import imageio_ffmpeg
from video_compat import encode_under_limit, probe, SIZE_LIMIT_MB

FF = imageio_ffmpeg.get_ffmpeg_exe()
OUT = ROOT / "웹업로드용_호환영상"
JOBS = [("법사", ROOT / "불교의례법사", (".mp4",)), ("해설사", ROOT / "불교해설사", (".avi", ".mp4"))]


def natural(p):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", p.name)]


def main():
    files = []
    for label, src_dir, exts in JOBS:
        for f in sorted((x for x in src_dir.iterdir() if x.suffix.lower() in exts), key=natural):
            files.append((label, f, OUT / label / f"{f.stem}.mp4"))
    total = len(files)
    print(f"총 {total}개 재압축 시작 (파일당 {SIZE_LIMIT_MB:.0f}MB 이하)")
    results, t_all = [], time.time()
    for i, (label, src, dst) in enumerate(files, 1):
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists():
            p = probe(FF, dst)
            if p["ok"] and dst.stat().st_size <= SIZE_LIMIT_MB * 1024 * 1024:
                print(f"[{i}/{total}] 건너뜀(완료됨) {label}/{dst.name}")
                results.append({"course": label, "file": dst.name, "mb": round(dst.stat().st_size / 1048576, 1), **p})
                continue
        t = time.time()
        print(f"[{i}/{total}] 압축 중 {label}/{src.name} ({src.stat().st_size / 1048576:.0f}MB)")
        try:
            size_mb, height = encode_under_limit(FF, src, dst, log=print)
            p = probe(FF, dst)
            print(f"[{i}/{total}] 완료 {dst.name} {size_mb:.1f}MB {height}p {time.time() - t:.0f}s 호환={'OK' if p['ok'] else 'FAIL'}")
            results.append({"course": label, "file": dst.name, "mb": round(size_mb, 1), **p})
        except Exception as e:
            print(f"[{i}/{total}] 실패 {src.name}: {e}")
            results.append({"course": label, "file": dst.name, "error": str(e), "ok": False})
    (OUT / "report.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    ok = sum(1 for r in results if r.get("ok"))
    for label in ("법사", "해설사"):
        mb = sum(r.get("mb", 0) for r in results if r["course"] == label)
        print(f"{label}: {sum(1 for r in results if r['course'] == label)}개, 총 {mb:.0f}MB")
    print(f"호환 검사 통과 {ok}/{total}, 최대 {max((r.get('mb', 0) for r in results), default=0):.1f}MB, 소요 {(time.time() - t_all) / 60:.0f}분")


if __name__ == "__main__":
    main()
