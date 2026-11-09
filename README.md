# Limelight — drop-a-song karaoke

**Live:** https://applejuice093.github.io/limelight-karaoke/

Drop an audio file and Limelight does the rest, all inside your browser. There are no API keys, no build step, and your audio is never uploaded.

## What happens when you drop a song
1. **Cache check.** If the same song was processed before, its lyrics load instantly from IndexedDB.
2. **Real lyrics lookup.** The title and artist are read from the ID3 tags or the filename ("Artist - Title.mp3"), then [LRCLIB](https://lrclib.net) is searched for synced lyrics with a matching duration.
3. **Automatic transcription (fallback).** The audio is decoded to 16 kHz mono and band-passed to the vocal range (120–5000 Hz). Whisper (`onnx-community/whisper-base_timestamped` via transformers.js, in a Web Worker) then transcribes it with word-level timestamps and automatic language detection. Words are grouped into lines automatically.
4. **Vocal removal.** Center-channel cancellation (L−R above 220 Hz) is mixed with the original bass below 220 Hz. It's on by default and can be toggled.
5. **Auto-start.** Playback starts and the mic permission prompt appears.

## Features
- Big stage lyrics with the current line highlighted, word-by-word fill (Whisper) or a line progress fill (LRC), dimmed neighbouring lines, auto-scroll, and click a line to seek
- Play/pause, seek, volume, speed 0.75–1.25×, keep-pitch toggle
- Live mic mixed in through Web Audio, with level, reverb, echo and a level meter
- Record your performance (music + voice) and download it
- Advanced menu: load or paste .lrc, plain-text tap-sync, re-transcribe, Whisper model choice (base / small), export .lrc, LRCLIB on/off
- Built-in demo song, responsive layout, keyboard shortcuts (Space play/pause, ←/→ seek, M mic, R record, Enter/T tap-sync)

## Run locally
```
python3 -m http.server 8000   # then open http://localhost:8000
```
Auto-transcription (module worker) and the mic need http(s), not `file://`.

## Tests
```
npm test                         # Node 18+, no install needed
# or: node --test tests/*.test.mjs
```
The tests cover the LRC parser (sorting, repeated timestamps, `[offset:]`, `[mm:ss:xx]` stamps, plain-text tap-sync), the time formatters, filename/ID3 metadata guessing and how Whisper words are grouped into lines.

## Supported files
- **Audio:** mp3, wav, ogg, m4a, flac, aac, opus (anything the browser can decode)
- **Lyrics:** `.lrc` (timed as `[mm:ss.xx]` or `[mm:ss:xx]`, `[offset:]` honoured) or `.txt` (plain lines open tap-sync)
- Other files are ignored with a notice.

## Privacy
Audio is processed locally and never uploaded. Two network requests can happen: the song's title/artist are sent to lrclib.net for the lyrics lookup (turn off "LRCLIB" in Advanced to stop this), and the Whisper model is downloaded once from the Hugging Face CDN via jsDelivr.

## Limitations
- The first transcription downloads the model once (~80 MB for base, ~250 MB for small), then the browser caches it. It runs on CPU (WASM), so it takes roughly 0.5–2× the song length.
- Whisper on sung vocals over music is imperfect: expect wrong words, especially with loud mixes. LRCLIB results are preferred when they exist, and the Advanced menu lets you paste correct lyrics.
- The band-pass filter is not true stem separation; there is no ML vocal isolation.
- Center-cancellation only removes vocals mixed dead-center. Reverb tails and stereo backing vocals remain, and mono files can't be processed.
- Mic latency depends on the device. Use headphones to avoid feedback.
