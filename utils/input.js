// Text entry with the system keyboard (API 4.0): voice dictation or the character keyboard.
import { createKeyboard, deleteKeyboard, inputType } from '@zos/ui'
import { showToast } from '@zos/interaction'

// onText(text) is called with the trimmed result; nothing happens on cancel or empty input.
export function ask(mode, onText, initial) {
  try {
    createKeyboard({
      inputType: mode === 'voice' ? inputType.VOICE : inputType.CHAR,
      text: initial || '',
      onComplete: (_, result) => {
        deleteKeyboard()
        const text = ((result && result.data) || '').trim()
        if (text) onText(text)
      },
      onCancel: () => deleteKeyboard()
    })
  } catch (e) {
    showToast({ content: mode === 'voice' ? 'Voice input unavailable' : 'Keyboard unavailable' })
  }
}

// Unique per prompt; the side service sends it as the Idempotency-Key.
export function requestId() {
  return 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}
