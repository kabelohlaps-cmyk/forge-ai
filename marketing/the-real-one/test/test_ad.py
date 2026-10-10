#!/usr/bin/env python3
"""Test the FORGE "The Real One" ad against the guide's rules.

1. Rule checks: the sum adds up, the kept number is under 30 %, the script is
   at most 12 lines / 75 words, the tempo is 95-120 BPM with the logo on a
   downbeat, and everything ends by 30 s.
2. Scratch voice: each VO clip is synthesised with espeak-ng at a natural and
   a slow ("soothing") pace, placed at its scripted time, and checked for
   collisions with the next clip and for running past the end.
3. Animatic: layout checks in 16:9 and 9:16 (frame edges, 9:16 safe zones,
   caption overlap), then a frame-accurate recording muxed with the scratch voice
   and a click track (accent on every bar) into scratch_test.mp4. The
   page is captured frame by frame at quarter speed, so it takes ~2 minutes.

espeak-ng is a robotic stand-in for the real narrator. Use it to check timing,
not to judge the sound.

Usage: python3 test_ad.py [--out DIR] [--wpm 155,130]
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ANIMATIC = HERE.parent / "animatic.html"
SR = 22050

# ---- the ad, as written in README.md -------------------------------------
BIG, COSTS = 40, {"References": 9, "Redraws": 8.5, "Renders": 6, "App-switching": 5.5}
KEPT = 11
SCRIPT_LINES = [  # the 12 spoken lines (step 02)
    "Your calendar is lying to you.",
    "It says forty hours of design this week.",
    "You actually designed... eleven.",
    "References ate nine.",
    "Redraws took eight and a half.",
    "Renders burned six.",
    "And app-switching?... Five and a half.",
    "Meet Forge.",
    "Sketch it. Render it. Turn it in three D. One studio.",
    "Fewer apps. More making.",
    "Forge.",
    "Establish the work of our hands.",
]
# VO clips as the editor places them: (start s, text). Long pauses are clip splits.
CLIPS = [
    (0.35, "Your calendar is lying to you."),
    (2.30, "It says forty hours of design this week."),
    (5.10, "You actually designed..."),
    (6.60, "eleven."),
    (7.90, "References ate nine."),
    (9.90, "Redraws took eight and a half."),
    (12.00, "Renders burned six."),
    (13.55, "And app-switching?"),
    (14.90, "Five and a half."),
    (16.00, "Meet"),
    (16.45, "Forge."),
    (17.50, "Sketch it."),
    (18.80, "Render it."),
    (20.00, "Turn it in three D."),
    (21.20, "One studio."),
    (23.30, "Fewer apps. More making."),
    (25.56, "Forge."),
    (26.43, "Establish the work of our hands."),
]
MUSIC_START, LOGO, BARS_TO_LOGO, FINAL_FORGE, END = 0.5, 16.45, 7, 25.56, 30.0
HOOK_LIMIT, CHORD_TAIL = 2.0, 0.5   # hook under 2 s; leave the last chord ringing
FRAME = 1 / 60

results = []
def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))


def rule_checks():
    spent = sum(COSTS.values())
    check("sum adds up exactly", BIG - spent == KEPT, f"{BIG} − {spent} = {BIG - spent}, script says {KEPT}")
    pct = KEPT / BIG * 100
    check("kept number under 30 % of big number", pct < 30, f"{pct:.1f} %")
    check("3–5 costs", 3 <= len(COSTS) <= 5, f"{len(COSTS)} costs")
    words = sum(len(re.findall(r"[A-Za-z'-]+", l)) for l in SCRIPT_LINES)
    check("script ≤ 12 lines", len(SCRIPT_LINES) <= 12, f"{len(SCRIPT_LINES)} lines")
    check("script ≤ 75 words", words <= 75, f"{words} words")
    bar = (LOGO - MUSIC_START) / BARS_TO_LOGO
    bpm = 240 / bar
    check("tempo 95–120 BPM", 95 <= bpm <= 120, f"{bpm:.1f} BPM, bar {bar:.3f} s")
    final = LOGO + 4 * bar
    check("final 'Forge.' on the downbeat 4 bars after the logo", abs(final - FINAL_FORGE) <= FRAME,
          f"downbeat at {final:.3f} s, scripted {FINAL_FORGE:.2f} s")
    check("logo clip starts on its downbeat", any(abs(t - LOGO) < 1e-6 and "Forge" in s for t, s in CLIPS), f"{LOGO} s")
    # the animatic must play the same timeline
    html = ANIMATIC.read_text()
    end = float(re.search(r"const END = ([\d.]+);", html).group(1))
    check("animatic ends by 30 s", end <= END, f"END = {end}")
    caps = [float(m) for m in re.findall(r"^\s*\[(\d+\.\d+),", html, re.M)]
    check("animatic captions in time order", caps == sorted(caps), "")
    for t, s in [(LOGO, "logo"), (FINAL_FORGE, "end card")]:
        check(f"animatic {s} at {t} s", f"{t:.2f}".rstrip("0") in html or f"{t}" in html, "")
    return bpm, bar


def synth(text, wpm, path):
    # Deepest stock male variant, pitched down: a rough stand-in for a deep voice.
    subprocess.run(["espeak-ng", "-v", "en+m3", "-p", "25", "-s", str(wpm), "-w", str(path), text],
                   check=True, capture_output=True)
    with wave.open(str(path)) as w:
        assert w.getframerate() == SR and w.getsampwidth() == 2
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    loud = np.nonzero(np.abs(a) > 0.02)[0]
    return a[loud[0]:loud[-1] + 1] if len(loud) else a   # trim espeak's silence


def voice_checks(wpm, work):
    clips, report = [], []
    for i, (t, text) in enumerate(CLIPS):
        audio = synth(text, wpm, work / f"vo-{wpm}-{i}.wav")
        clips.append((t, audio))
        end = t + len(audio) / SR
        limit = CLIPS[i + 1][0] - 0.05 if i + 1 < len(CLIPS) else END - CHORD_TAIL
        report.append((t, text, end, limit))
    hook_end = report[0][2]
    check(f"[{wpm} wpm] hook ends under {HOOK_LIMIT} s", hook_end <= HOOK_LIMIT, f"ends at {hook_end:.2f} s")
    late = [(t, txt, e, lim) for t, txt, e, lim in report if e > lim]
    check(f"[{wpm} wpm] no clip runs into the next", not late,
          "; ".join(f"'{txt}' ends {e:.2f} s, needs ≤ {lim:.2f} s (over by {e - lim:.2f})" for t, txt, e, lim in late))
    return clips, report


def click_track(bar, length):
    out = np.zeros(int(length * SR), np.float32)
    beat = bar / 4
    n = 0
    while MUSIC_START + n * beat < length:
        t = MUSIC_START + n * beat
        f, amp = (1320, 0.25) if n % 4 == 0 else (660, 0.08)
        s = np.arange(int(0.05 * SR)) / SR
        tone = amp * np.sin(2 * np.pi * f * s) * np.exp(-s * 60)
        i = int(t * SR); out[i:i + len(tone)] += tone[: len(out) - i]
        n += 1
    return out


def mix(clips, bar, length):
    out = click_track(bar, length)
    for t, a in clips:
        i = int(t * SR); out[i:i + len(a)] += 0.9 * a[: len(out) - i]
    return np.clip(out, -1, 1)


def write_wav(path, a):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--wpm", default="155,130", help="natural,soothing speaking rates for the scratch voice")
    args = ap.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(dir=out))

    bpm, bar = rule_checks()
    reports = {}
    for wpm in [int(x) for x in args.wpm.split(",")]:
        clips, reports[wpm] = voice_checks(wpm, work)
    slow = int(args.wpm.split(",")[-1])
    write_wav(out / "scratch_vo_click.wav", mix(clips, bar, END))

    env = dict(os.environ, NODE_PATH=subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip())
    br = subprocess.run(["node", str(HERE / "browser.cjs"), str(ANIMATIC), str(out), str(END)],
                        capture_output=True, text=True, env=env)
    if br.returncode:
        print(br.stderr); sys.exit(2)
    b = json.loads(br.stdout.strip().splitlines()[-1])
    check("animatic has no JS errors", not b["errors"], "; ".join(b["errors"]))
    for aspect in ("16:9", "9:16"):
        bad = [f"{x['t']} s: {', '.join(x['issues'])}" for x in b["layout"] if x["aspect"] == aspect and x["issues"]]
        n = sum(1 for x in b["layout"] if x["aspect"] == aspect)
        check(f"{aspect} layout ({n} sampled frames)", not bad, " | ".join(bad))

    # assemble the frames at their page timestamps, then add the scratch audio
    video = out / "scratch_test.mp4"
    frames = [(f, t) for f, t in b["frames"] if 0 <= t <= END]
    concat = work / "frames.txt"
    with open(concat, "w") as fh:
        for (f, t), nxt in zip(frames, frames[1:] + [(None, END)]):
            fh.write(f"file '{f}'\nduration {max(nxt[1] - t, 0.001):.4f}\n")
        fh.write(f"file '{frames[-1][0]}'\n")
    lead = frames[0][1]   # first frame lands a few ms after t = 0
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(concat),
                    "-i", str(out / "scratch_vo_click.wav"), "-filter_complex",
                    f"[0:v]tpad=start_duration={lead:.4f}:start_mode=clone,fps=30,format=yuv420p[v]",
                    "-map", "[v]", "-map", "1:a", "-t", str(END), "-c:v", "libx264", "-crf", "20",
                    "-c:a", "aac", "-b:a", "128k", str(video)], check=True)
    gaps = np.diff([t for _, t in frames])
    check("recording has ≥ 24 frames per second throughout", gaps.max() <= 1 / 24,
          f"{len(frames)} frames, largest gap {gaps.max() * 1000:.0f} ms")
    shutil.rmtree(Path(frames[0][0]).parent); shutil.rmtree(work)

    # ---- report ----
    print(f"\nFORGE ad test · {bpm:.1f} BPM · scratch voice espeak-ng\n")
    for wpm, rep in reports.items():
        print(f"VO placement at {wpm} wpm" + ("  (soothing pace, used in the video)" if wpm == slow else ""))
        for t, txt, e, lim in rep:
            flag = "OVER " if e > lim else "ok   "
            print(f"  {flag}{t:6.2f} → {e:6.2f}  slack {lim - e:+5.2f}  {txt}")
        print()
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))
    fails = sum(not ok for _, ok, _ in results)
    print(f"\n{len(results) - fails} passed, {fails} failed · video: {video}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
