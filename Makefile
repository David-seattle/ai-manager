.PHONY: test lint smoke setup

test: ## Run unit tests
	cd app && uv run pytest

lint: ## Lint (no-op for now)
	@echo "lint: no-op"

setup: ## Install dependencies (including test deps)
	cd app && uv sync --extra dev

smoke: ## Integration smoke test (parallel-safe, uses docker compose)
	./tests/smoke.sh
