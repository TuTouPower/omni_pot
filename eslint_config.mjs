import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: [
            'node_modules/**',
            'build/**',
            'dist/**',
            '.claude/**',
            'public/**',
            'docs/**'
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
        files: ['tests/e2e/fixtures/test.ts'],
        rules: {
            'react-hooks/rules-of-hooks': 'off'
        }
    },
    {
        files: ['**/*.{js,mjs,cjs}'],
        extends: [tseslint.configs.disableTypeChecked]
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            globals: {
                Buffer: 'readonly',
                URL: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                process: 'readonly'
            }
        }
    },
    {
        files: ['scripts/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-base-to-string': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off'
        }
    }
)
