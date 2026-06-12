# Dictionary

Omni Pot's dictionary feature automatically routes to the appropriate dictionary based on the input language: English words go to English dictionaries, Chinese characters go to Chinese dictionaries.

## Usage

1. Select text and press the dictionary hotkey (must be configured in settings first)
2. Or click "Dictionary" in the system tray
3. The dictionary window appears with lookup results

You can also type directly into the dictionary window to look up words.

## Dictionary Window

### Source Word Card

The top of the window shows the query word, which you can edit directly. Press `Enter` to re-lookup.

- Left: Language detection label (e.g. "Detected: English")
- Right: Copy word, Lookup buttons

### Result Cards

Different dictionaries are used based on input language:

**English input**:
- Cambridge Dictionary — provides phonetics, parts of speech, definitions, and examples

**Chinese input**:
- Chinese Dictionary — local offline dictionary with 320K words, 16K characters, 50K idioms
- CC-CEDICT — offline English-Chinese dictionary

Each card contains:
- **Pronunciation**: shown inside the card (English dictionaries play audio when available)
- **Definitions**: grouped by part of speech, with numbered entries
- **Examples**: thin line separator, source/target text in two lines

Chinese dictionary cards hide part-of-speech tags and read-aloud buttons.

## Dictionary Settings

Manage dictionary services in **Settings > Services**:

- **Chinese Dictionary** tab: manage Chinese dictionary service instances
- **English Dictionary** tab: manage English dictionary service instances

Chinese Dictionary is a local offline dictionary (86 MB SQLite database) that requires no network or API key. It can be disabled in settings to save disk space.
