#!/usr/bin/env python3
"""Local Whisper transcription for motion-director (free, offline after the first model download).

Two jobs:
  word timings  python transcribe.py --words vo/l1.wav vo/l2.wav
                Prints each word's start (seconds from the clip start) for buildSentence({ times }).
  mix check     python transcribe.py renders/final.mp4
                Transcribes the finished video. Every voice line should come back, at the right time;
                a missing or garbled line means the voice is buried under music or SFX.

Requires: pip install openai-whisper (plus ffmpeg on PATH).
"""
import argparse
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="+", help="audio or video files")
    parser.add_argument("--words", action="store_true", help="print word-level start times")
    parser.add_argument("--model", default="base", help="whisper model size (default: base)")
    parser.add_argument("--language", default="en")
    args = parser.parse_args()

    try:
        import whisper
    except ImportError:
        print("openai-whisper is not installed: pip install openai-whisper", file=sys.stderr)
        return 1

    model = whisper.load_model(args.model)
    for path in args.files:
        result = model.transcribe(path, fp16=False, language=args.language, word_timestamps=args.words)
        print(f"== {path}")
        for segment in result["segments"]:
            if args.words:
                words = [f"{w['word'].strip()}@{w['start']:.2f}" for w in segment.get("words", [])]
                print("  " + "  ".join(words))
            else:
                print(f"  [{segment['start']:6.2f} - {segment['end']:6.2f}] {segment['text'].strip()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
