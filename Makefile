.PHONY: test test-app test-dashboard lint typecheck build smoke setup up down rebuild recreate logs help cxdb

# strongdm/cxdb - pinned commit (no published Docker image)
CXDB_REPO := https://github.com/strongdm/cxdb.git
CXDB_COMMIT := 0ecde495064537a7019ec88405fb078a756a85c8
CXDB_IMAGE := cxdb/cxdb:latest

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-16s %s\n", $$1, $$2}'

test: test-app test-dashboard ## Run all tests

test-app: ## Run Python unit tests
	cd app && uv run pytest

test-dashboard: ## Run dashboard unit tests
	cd dashboard && npm test

lint: ## Lint (no-op for now)
	@echo "lint: no-op"

typecheck: ## Type-check dashboard
	cd dashboard && npx tsc --noEmit

build: ## Build all Docker images
	docker compose build

cxdb: ## Build CXDB image if not present locally
	@docker image inspect $(CXDB_IMAGE) >/dev/null 2>&1 || \
		(echo "Building $(CXDB_IMAGE) from $(CXDB_REPO)@$(CXDB_COMMIT)..." && \
		docker build -t $(CXDB_IMAGE) "$(CXDB_REPO)#$(CXDB_COMMIT)")

setup: cxdb ## Install all dependencies
	cd app && uv sync --extra dev
	cd dashboard && npm install

smoke: ## Integration smoke test (parallel-safe, uses docker compose)
	./tests/smoke.sh

up: cxdb ## Start all containers
	docker compose up -d

down: ## Stop all containers
	docker compose down

rebuild: ## Stop, rebuild, and start all containers
	docker compose down
	docker compose build
	docker compose up -d
	@echo "Containers rebuilt and started"

recreate: ## Rebuild and restart a single service (e.g. make recreate SVC=app)
	@if [ -z "$(SVC)" ]; then echo "Usage: make recreate SVC=<service-name>"; exit 1; fi
	docker compose up --build --no-deps -d $(SVC)

logs: ## Follow container logs
	docker compose logs -f
