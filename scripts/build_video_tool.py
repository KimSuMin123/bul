"""관리자 화면에서 내려받는 강의 영상 변환 도구 zip을 만든다.

tools/video-converter/ 의 .bat·사용법 + ffmpeg.exe(imageio-ffmpeg 번들) → public/downloads/sba-video-converter.zip
.bat 이나 사용법을 고친 뒤 다시 실행한다: python scripts/build_video_tool.py
"""
import zipfile
from pathlib import Path

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "video-converter"
OUT = ROOT / "public" / "downloads" / "sba-video-converter.zip"
FOLDER = "세화_강의영상_변환도구"


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in sorted(SRC.iterdir()):
            zf.write(path, f"{FOLDER}/{path.name}")
        zf.write(imageio_ffmpeg.get_ffmpeg_exe(), f"{FOLDER}/ffmpeg.exe")
    print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024 / 1024:.1f}MB")


if __name__ == "__main__":
    main()
