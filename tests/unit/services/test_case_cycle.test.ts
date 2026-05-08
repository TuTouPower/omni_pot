import { describe, it, expect } from 'vitest'

type CaseFormat = 'snake' | 'screaming_snake' | 'kebab' | 'dot' | 'space' | 'title' | 'camel' | 'pascal'

const CASE_CYCLE: CaseFormat[] = ['snake', 'screaming_snake', 'kebab', 'dot', 'space', 'title', 'camel', 'pascal']

function detect_current_format(text: string): CaseFormat {
  if (text.includes('_') && text === text.toUpperCase()) return 'screaming_snake'
  if (text.includes('_')) return 'snake'
  if (text.includes('-')) return 'kebab'
  if (text.includes('.') && !text.includes(' ')) return 'dot'
  if (text.includes(' ') && /^(?:[A-Z][a-z]* )*[A-Z][a-z]*$/.test(text)) return 'title'
  if (text.includes(' ')) return 'space'
  if (/^[A-Z]/.test(text) && /[a-z]/.test(text) && !text.includes('_') && !text.includes('-') && !text.includes(' ')) return 'pascal'
  if (text === text.toUpperCase() && text.length > 1) return 'screaming_snake'
  if (/^[a-z]/.test(text) && /[A-Z]/.test(text)) return 'camel'
  return 'snake'
}

function split_words(text: string): string[] {
  if (text.includes('_')) return text.split('_').filter(Boolean)
  if (text.includes('-')) return text.split('-').filter(Boolean)
  if (text.includes('.')) return text.split('.').filter(Boolean)
  if (text.includes(' ')) return text.split(/\s+/).filter(Boolean)
  return text.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/).filter(Boolean)
}

function apply_format(words: string[], format: CaseFormat): string {
  const lower = words.map((w) => w.toLowerCase())
  switch (format) {
    case 'snake': return lower.join('_')
    case 'screaming_snake': return lower.join('_').toUpperCase()
    case 'kebab': return lower.join('-')
    case 'dot': return lower.join('.')
    case 'space': return lower.join(' ')
    case 'title': return lower.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    case 'camel': return lower.map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('')
    case 'pascal': return lower.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  }
}

function cycle_variable_name(text: string): string {
  const current = detect_current_format(text)
  const idx = CASE_CYCLE.indexOf(current)
  const next = CASE_CYCLE[(idx + 1) % CASE_CYCLE.length]
  const words = split_words(text)
  return apply_format(words, next)
}

describe('variable name case cycling', () => {
    it('cycles snake_case -> SCREAMING_SNAKE', () => {
        expect(cycle_variable_name('hello_world')).toBe('HELLO_WORLD')
    })

    it('cycles SCREAMING_SNAKE -> kebab-case', () => {
        expect(cycle_variable_name('HELLO_WORLD')).toBe('hello-world')
    })

    it('cycles kebab-case -> dot.notation', () => {
        expect(cycle_variable_name('hello-world')).toBe('hello.world')
    })

    it('cycles dot.notation -> space', () => {
        expect(cycle_variable_name('hello.world')).toBe('hello world')
    })

    it('cycles space -> Title Case', () => {
        expect(cycle_variable_name('hello world')).toBe('Hello World')
    })

    it('cycles Title Case -> camelCase', () => {
        expect(cycle_variable_name('Hello World')).toBe('helloWorld')
    })

    it('cycles camelCase -> PascalCase', () => {
        expect(cycle_variable_name('helloWorld')).toBe('HelloWorld')
    })

    it('cycles PascalCase -> snake_case', () => {
        expect(cycle_variable_name('HelloWorld')).toBe('hello_world')
    })

    it('handles single word', () => {
        expect(cycle_variable_name('hello')).toBe('HELLO')
    })

    it('full cycle returns to start', () => {
        let text = 'hello_world'
        for (let i = 0; i < 8; i++) {
            text = cycle_variable_name(text)
        }
        expect(text).toBe('hello_world')
    })
})
