export {
    handleCaptureClock,
    handleOpenWindow,
    handleWindowState,
    handle_window_display,
    handle_primary_display,
    handle_trigger_screenshot,
    handle_open_recognize,
} from './e2e_window_handlers'

export {
    handleTriggerSelection,
    handleTriggerDict,
    handleTriggerClipboard,
    handleTriggerClipboardTranslate,
    handle_trigger_hotkey,
    handle_hotkey_system_failures,
} from './e2e_trigger_handlers'

export {
    handleResetConfig,
    handleSetConfig,
    handleReadClipboard,
    handle_read_clipboard_image,
    handle_add_history,
    handle_trigger_input_translate,
    handle_tray_action,
    handle_tray_menu,
    handle_mock_update,
} from './e2e_data_handlers'
