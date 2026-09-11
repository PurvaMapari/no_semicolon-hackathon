# PRISM — Voice Interaction

**Owner:** M4 (Assessment + Voice + Integration)
**Status:** Day-1 core feature (not a stretch goal)

---

## Architecture

```
Voice Input (microphone)
      ↓
Speech-to-Text (Web Speech Recognition API)
      ↓
Transcript (raw text)
      ↓
Intent Router (deterministic pattern matching)
      ↓
PRISM Context (current concept, session state)
      ↓
Action (TTS, variant swap, answer submit, navigate)
      ↓
UI Update + Text-to-Speech response
```

---

## Speech-to-Text (STT)

**Technology:** Web Speech Recognition API (SpeechRecognition)

**Browser support:** Chrome, Edge (Chromium-based). Limited in Firefox/Safari.

### Configuration

```javascript
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = false;     // Single utterance mode
recognition.interimResults = false; // Wait for final result
recognition.lang = 'en-US';
recognition.maxAlternatives = 1;
```

### Lifecycle

1. User clicks voice button (or presses `V` key)
2. Visual indicator: mic icon pulses red, "Listening..." text
3. Recognition starts
4. User speaks
5. Recognition returns transcript
6. Intent router processes transcript
7. Action executed
8. Voice response via TTS (if applicable)

### Error Handling

| Error | Behavior |
|-------|----------|
| `no-speech` | Show "Didn't hear anything. Try again." |
| `audio-capture` | Show "Microphone not available. Use text controls instead." |
| `not-allowed` | Show "Microphone permission denied. Enable in browser settings." |
| `network` | Show "Voice requires internet. Use text controls instead." |
| `aborted` | Silent — user cancelled |
| Browser not supported | Hide voice button entirely, log warning |

---

## Text-to-Speech (TTS)

**Technology:** Web Speech Synthesis API (SpeechSynthesis)

### Configuration

```javascript
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = profile.readAloudRate;   // 0.5–2.0
utterance.pitch = profile.readAloudPitch; // 0.5–2.0
utterance.lang = 'en-US';

// Use profile's preferred voice if set
if (profile.preferredVoice) {
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name === profile.preferredVoice);
  if (preferred) utterance.voice = preferred;
}
```

### Playback Controls

| Control | Action |
|---------|--------|
| Play | `speechSynthesis.speak(utterance)` |
| Pause | `speechSynthesis.pause()` |
| Resume | `speechSynthesis.resume()` |
| Stop | `speechSynthesis.cancel()` |
| Speed up | Increase `utterance.rate` by 0.25 |
| Slow down | Decrease `utterance.rate` by 0.25 |

### Synced Word Highlighting (Nice-to-Have)

```javascript
utterance.onboundary = (event) => {
  if (event.name === 'word') {
    const wordIndex = event.charIndex;
    highlightWordAt(wordIndex);
  }
};
```

**Note:** `onboundary` support varies by browser. If unavailable, degrade to sentence-level highlighting using `onend` events per sentence.

---

## Voice Intents

### Intent Routing Table

| Voice Command (examples) | Intent ID | Pattern Match | Action | Signal Generated |
|--------------------------|-----------|---------------|--------|-----------------|
| "Read this", "Read aloud", "Start reading" | `read_aloud` | `/read|start reading/i` | Start TTS for current concept | No |
| "Explain this", "What does this mean" | `explain` | `/explain|what does.*mean/i` | Show explanation variant | Yes: `helpRequests++` |
| "Explain it simply", "Make it simpler", "Simplify" | `explain_simply` | `/simpl|easier|make it/i` | Switch to next simplification level | Yes: `helpRequests++` |
| "Give me an example", "Show example" | `example` | `/example/i` | Show visual description | Yes: `helpRequests++` |
| "Repeat that", "Say it again", "Read it again" | `repeat` | `/repeat|again/i` | Restart TTS for current concept | Yes: `helpRequests++` |
| "Answer A/B/C/D", "Option 1/2/3/4", "True/False" | `answer` | `/answer|option|true|false|^[a-d]$/i` | Submit quiz answer | No |
| "Next", "Go forward", "Continue" | `navigate_next` | `/next|forward|continue/i` | Navigate to next concept | No |
| "Go back", "Previous", "Back" | `navigate_back` | `/back|previous/i` | Navigate to previous concept | No |
| "Stop", "Pause", "Be quiet" | `stop_audio` | `/stop|pause|quiet/i` | Stop TTS playback | No |
| "Help", "What can I say" | `help` | `/help|what can/i` | Show voice command list | No |

### Intent Router Implementation

```javascript
function routeIntent(transcript) {
  const text = transcript.toLowerCase().trim();

  const patterns = [
    { intent: 'read_aloud', pattern: /\b(read|start reading)\b/i },
    { intent: 'explain_simply', pattern: /\b(simpl|easier|make it)\b/i },
    { intent: 'explain', pattern: /\b(explain|what does.*mean)\b/i },
    { intent: 'example', pattern: /\b(example)\b/i },
    { intent: 'repeat', pattern: /\b(repeat|again)\b/i },
    { intent: 'answer', pattern: /\b(answer|option|true|false)\b|^[a-d]$/i },
    { intent: 'navigate_next', pattern: /\b(next|forward|continue)\b/i },
    { intent: 'navigate_back', pattern: /\b(back|previous)\b/i },
    { intent: 'stop_audio', pattern: /\b(stop|pause|quiet)\b/i },
    { intent: 'help', pattern: /\b(help|what can)\b/i },
  ];

  // Order matters — more specific patterns first
  for (const { intent, pattern } of patterns) {
    if (pattern.test(text)) return intent;
  }

  return 'unknown';
}
```

**Note:** `explain_simply` is matched BEFORE `explain` because "simply" is more specific.

---

## Voice Context

The intent router uses the current session context to determine the correct action:

```javascript
function resolveAction(intent, context) {
  const { currentConceptId, currentVariantLevel, sessionState } = context;

  switch (intent) {
    case 'read_aloud':
      return { type: 'start_tts', conceptId: currentConceptId };

    case 'explain':
      return { type: 'show_explanation', conceptId: currentConceptId };

    case 'explain_simply':
      const nextLevel = Math.min(currentVariantLevel + 1, 3);
      return { type: 'switch_variant', conceptId: currentConceptId, targetLevel: nextLevel };

    case 'example':
      return { type: 'show_visual_description', conceptId: currentConceptId };

    case 'repeat':
      return { type: 'restart_tts', conceptId: currentConceptId };

    case 'answer':
      return { type: 'submit_answer', /* extract option from transcript */ };

    case 'navigate_next':
      return { type: 'next_chunk' };

    case 'navigate_back':
      return { type: 'prev_chunk' };

    case 'stop_audio':
      return { type: 'stop_tts' };

    case 'help':
      return { type: 'show_voice_help' };

    default:
      return { type: 'unknown', spokenResponse: "I didn't understand that. Try saying 'read this', 'explain this', or 'next'." };
  }
}
```

---

## Voice Quiz Answers

When the learner says an answer during a quiz:

```javascript
function extractAnswer(transcript) {
  const text = transcript.toLowerCase().trim();

  // Match "answer A", "option 1", "A", "1", "true", "false"
  const letterMatch = text.match(/\b([a-d])\b/);
  if (letterMatch) return letterMatch[1]; // 'a', 'b', 'c', or 'd'

  const numberMatch = text.match(/\b([1-4])\b/);
  if (numberMatch) return String.fromCharCode(96 + parseInt(numberMatch[1])); // 1→'a', etc.

  if (/\btrue\b/.test(text)) return 'true';
  if (/\bfalse\b/.test(text)) return 'false';

  return null; // Could not parse answer
}
```

---

## Voice Signals → SCALE

Voice help requests generate learner signals that feed into the SCALE engine:

| Voice Intent | Signal |
|-------------|--------|
| `explain` | `helpRequests += 1` |
| `explain_simply` | `helpRequests += 1`, `voiceHelpRequests += 1` |
| `example` | `helpRequests += 1`, `voiceHelpRequests += 1` |
| `repeat` | `helpRequests += 1`, `voiceHelpRequests += 1` |

These signals contribute to the struggle score. A learner who frequently asks for explanations via voice will trigger REWIRE, just like one who re-reads or answers incorrectly.

---

## Playback Speed

| Speed | Rate Value | Label |
|-------|-----------|-------|
| Very Slow | 0.5 | 0.5x |
| Slow | 0.75 | 0.75x |
| Normal | 1.0 | 1x |
| Fast | 1.25 | 1.25x |
| Very Fast | 1.5 | 1.5x |
| Maximum | 2.0 | 2x |

Accessible via slider or voice commands: "faster", "slower", "normal speed".

---

## Transcript Display

When TTS reads content:
- Current sentence highlighted in reader
- Spoken text shown as subtitle/caption below reader (for deaf/hard-of-hearing users)
- Caption text matches TTS output exactly

---

## Fallbacks

| Failure | Fallback |
|---------|----------|
| STT not supported (browser) | Hide voice input button, show text controls only |
| STT permission denied | Show permission instructions, use text controls |
| STT returns empty | Show "Didn't catch that. Try again." + text fallback |
| STT returns unrecognized intent | Show "I didn't understand. Try 'read this' or 'explain this'." |
| TTS not supported | Show text-only content (no read-aloud) |
| TTS voice not available | Use default system voice |
| Network error during STT | Show "Voice requires internet connection." |

**Rule:** Every voice action has a text-based equivalent. Voice is an enhancement, not a requirement.

---

## Privacy

- **Microphone access:** Requested only when user clicks voice button. Not auto-activated.
- **Audio recording:** No audio is recorded or stored. STT processes in real-time, only the text transcript is used.
- **Transcript storage:** Voice transcripts are not persisted. Used only for intent routing during the current session.
- **Third-party:** Web Speech API may use cloud-based recognition (browser-dependent). PRISM does not send voice data to any additional third party.
- **Consent:** Clear microphone permission prompt via browser native dialog.
