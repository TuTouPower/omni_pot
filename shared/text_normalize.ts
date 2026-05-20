/**
 * Normalize recognized text by removing hyphenation and collapsing whitespace.
 * Used by OCR and recognize windows when `recognize_delete_newline` is enabled.
 */
export function normalize_recognized_text(text: string): string {
    return text.replace(/-\s+/g, '').replace(/\s+/g, ' ')
}
