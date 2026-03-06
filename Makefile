.PHONY: test test-app test-dashboard lint typecheck build smoke setup

test: test-app test-dashboard ## Run all tests

test-app: ## Run Python unit tests
	cd app && uv run pytest

test-dashboard: ## Run dashboard unit tests
	cd dashboard && npm test

lint: ## Lint (no-op for now)
	@echo "lint: no-op"

typecheck: ## Type-check dashboard
	cd dashboard && npx tsc --noEmit

build: ## Build dashboard
	cd dashboard && npm run build

setup: ## Install all dependencies
	cd app && uv sync --extra dev
	cd dashboard && npm install

smoke: ## Integration smoke test (parallel-safe, uses docker compose)
	./tests/smoke.sh
