# Translation

Omni Pot's translation feature supports multiple usage methods: selection translation, input translation, and clipboard monitoring. Multiple engines run in parallel and results are displayed as side-by-side cards.

## Usage Methods

### Selection Translation

1. Select text in any application
2. Press the translation hotkey (must be configured in settings first)
3. Omni Pot pops up a translation window showing the result

### Input Translation

When no text is selected, pressing the translation hotkey (or clicking "Translate" in the system tray) opens an empty translation window. Type text and press `Enter` to translate.

### Clipboard Monitoring

Enable "Clipboard Monitor" in settings or from the system tray. When enabled, each time new text is copied to the clipboard, Omni Pot automatically pops up the translation window and translates it.

> When clipboard monitoring is off, no resources are consumed.

## Translation Window

The translation window consists of three areas:

### Source Text Area

- Text input auto-grows up to 8 lines, then scrolls internally
- Detected language label (e.g. "Detected: English") shown in primary color
- Action buttons: **Remove Newlines** | **Remove Spaces** | **Read Aloud** | **Copy Source** | **Clear** | **Translate**
- `Enter` triggers translation, `Shift+Enter` inserts newline, `Escape` closes window

### Language Area

Centered display: Auto Detect -> Simplified Chinese

- Click a language name to switch source or target language
- Click the swap icon to exchange source and target languages

### Result Area

- Each enabled translation service displays a result card
- Cards are collapsed while waiting, showing a lightweight animation
- Cards auto-expand when results arrive, window height adjusts accordingly
- Card actions (top-right): **Read Aloud** | **Copy** | **Collapse**
- Failed translations show a red error message and retry button
- Cards can be dragged to reorder; order is saved automatically

## Window Behavior

| Setting | Description |
|---|---|
| Pinned | Keeps window open when it loses focus |
| Always on Top | Window stays above all others (auto-enables pinned) |
| Remember Window Size | Saves user-adjusted width for next open |
| Window Position | Mouse position / Previous position |

## Translation Settings

Configure in **Settings > Translation**:

| Setting | Description |
|---|---|
| Source / Target Language | Default translation direction, supports auto-detect |
| Second Language | Fallback when detected language matches target |
| Auto Copy | Copy translation to clipboard on success |
| Incremental Translation | New text appends to existing source |
| Dynamic Translation | Auto-translate while typing (1s debounce) |
| Auto Remove Newlines | Normalize incoming text newlines and hyphenation |
| Disable History | Don't save translation records |

## Supported Translation Services

Omni Pot includes 19 translation engines, managed in **Settings > Services > Translation**:

| Service | Notes |
|---|---|
| Bing Translator | Free, no key required |
| Google Translate | Free, no key required |
| DeepL | Supports Free / API / DeepLX |
| MyMemory | Free, no key required |
| Baidu Translate | Requires AppID + Secret |
| Youdao Translate | Requires AppID + Secret |
| Alibaba Translate | Requires AccessKey |
| Tencent Translate | Requires SecretId + SecretKey |
| Volcengine Translate | Requires AppID + Secret |
| Caiyun | Requires Token |
| Niutrans | Requires API Key |
| ChatGLM | Requires API Key, streaming |
| Gemini Pro | Requires API Key, streaming |
| Ollama | Local LLM, no key required |

Defaults enabled: Bing Translator, DeepL, MyMemory.
