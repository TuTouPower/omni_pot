import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: [
            'node_modules/**',
            'out/**',
            'dist/**',
            'release/**',
            'playwright-report/**',
            'tests/user_e2e/test-results/**',
            'data/**'
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname
            }
        },
        plugins: {
            'react-hooks': reactHooks
        },
        rules: {
            '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            'react-hooks/exhaustive-deps': 'error',
            'react-hooks/rules-of-hooks': 'error'
        }
    },
    {
        files: ['postcss.config.js', 'tailwind.config.js'],
        languageOptions: {
            globals: {
                module: 'readonly',
                require: 'readonly'
            }
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off'
        }
    },
    {
        files: ['tests/user_e2e/fixtures/test.ts'],
        rules: {
            'react-hooks/rules-of-hooks': 'off'
        }
    },
    {
        files: ['*.js', '*.mjs', '*.cjs'],
        extends: [tseslint.configs.disableTypeChecked]
    }
)
