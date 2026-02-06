module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'perf', 'build', 'ci', 'style'],
    ],
    'scope-empty': [2, 'never'],
    'scope-enum': [2, 'always', ['repo', 'docs', 'server', 'db', 'etl', 'api']],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    // leave subject-case flexible (teams differ here)
    'subject-case': [0],
  },
};
