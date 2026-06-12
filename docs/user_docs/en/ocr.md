# OCR & Screenshot Translation

Omni Pot supports text recognition from screenshots (OCR) and automatic translation after recognition (Screenshot Translation).

## OCR

1. Press the OCR hotkey (must be configured in settings first)
2. A screenshot overlay appears; drag to select the area to recognize
3. Press `Enter` or release the mouse to confirm; press `Escape` or right-click to cancel
4. The OCR window opens with the screenshot on the left and recognized text on the right

### Screenshot Controls

- **Drag**: Create selection with primary-color border and size labels
- **Enter / Release Mouse**: Confirm selection
- **Escape / Right-click**: Cancel screenshot

### OCR Window Layout

The window has three rows:

1. **Title bar**: Mode label (OCR), Pin/Topmost buttons, Close button
2. **Middle**: Left side shows screenshot image (large card); right side has two small cards stacked vertically — recognized text (editable) and translated text
3. **Action bar**:
   - Left: Copy Image | Select OCR Engine | Auto Detect
   - Right: Translate | Remove Newlines | Remove Spaces | Copy Text | Export

### Supported OCR Engines

| Engine | Notes |
|---|---|
| Tesseract | Local OCR, multi-language support (downloads language packs) |
| System OCR | Windows WinRT / macOS Vision, supports Chinese and English |
| QR Code | Local QR code recognition |
| Baidu OCR | Requires client_id + client_secret |
| Tencent OCR | Requires secretId + secretKey |
| Volcengine OCR | Requires appid + secret |
| iFlytek OCR | Requires appid + apisecret + apikey |
| AI Vision | OpenAI-compatible vision model, requires API Key |

## Screenshot Translation

Screenshot Translation = OCR + Auto Translate, an extension of the OCR workflow.

1. Press the screenshot translation hotkey (must be configured in settings first)
2. Drag to select the area to recognize
3. Recognized text is automatically sent to the translation card on the right

### Button Differences

In screenshot translation mode, the language bar adds a target language selector ("Auto Detect -> Simplified Chinese"), and the bottom bar does not show a standalone "Translate" button.

### Auto-Linking

- Switching OCR language: auto re-recognizes and refreshes translation
- Switching target language: auto re-translates (without re-recognizing)
- Once established, target language is not changed by OCR language updates

## Export

Export recognized text in the following formats:

- Markdown (.md)
- Plain Text (.txt)
- Word Document (.docx)
- Word 97 (.doc)

## OCR Settings

Configure in **Settings > OCR**:

| Setting | Description |
|---|---|
| Default OCR Engine | Select the default OCR service |
| Default OCR Language | Default is auto-detect |
| Auto Remove Newlines | Normalize newlines after recognition (off by default) |
| Auto Copy Result | Copy text to clipboard after recognition (on by default) |
