import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            // Forbid template literals (e.g., `string ${value}`)
            // Use string concatenation instead: 'string ' + value
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'TemplateLiteral',
                    message: 'Template literals are not allowed. Use string concatenation instead.',
                },
            ],
        },
    },
    {
        // Exclude test files and scripts from this rule
        files: ['**/*.test.ts', 'scripts/**/*.ts'],
        rules: {
            'no-restricted-syntax': 'off',
        },
    }
);
