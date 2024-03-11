import loguxConfig from '@logux/eslint-config'
import globals from 'globals'

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  { ignores: ['dist/'] },
  ...loguxConfig,
  {
    files: ['scripts/*.js'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: globals.browser
    }
  }
]
