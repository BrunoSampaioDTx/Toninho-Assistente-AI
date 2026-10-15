# Shortcuts for the most used npm scripts. Recipes use only npm/node so they work from cmd, PowerShell and Git Bash.

.DEFAULT_GOAL := help
.PHONY: help install dev build typecheck test check zip clean

help:
	@node -e "console.log([	'Usage: make [target]', '',	'  install    Install dependencies (npm ci)',	'  dev        Watch build into dist/ with HMR',	'  build      Typecheck + production build into dist/',	'  typecheck  TypeScript check only',	'  test       Run unit tests',	'  check      Typecheck + tests',	'  zip        Build and package release/llm-form-assistant-v[version].zip',	'  clean      Remove dist/',	].join('\n'))"

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

typecheck:
	npm run typecheck

test:
	npm test

check: typecheck test

zip:
	npm run zip

clean:
	node -e "require('fs').rmSync('dist', { recursive: true, force: true })"
