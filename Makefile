# PrivyQ — top-level developer tasks.
COMPOSE := docker compose -f deploy/docker-compose.yml

.PHONY: help dev up down logs build test proto core-test sdk-test gateway-test

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n",$$1,$$2}'

dev: up ## Bring up the full stack (alias for up)

up: ## Start core + gateway + frontend + postgres
	$(COMPOSE) up --build -d
	@echo "gateway:  http://localhost:8000/docs"
	@echo "frontend: http://localhost:3000"

down: ## Stop the stack
	$(COMPOSE) down

logs: ## Tail stack logs
	$(COMPOSE) logs -f

test: core-test sdk-test gateway-test ## Run all component test suites

core-test: ## Go core tests
	cd core-go && go test ./...

sdk-test: ## Python SDK tests
	cd sdk-python && python -m pytest -q

gateway-test: ## Gateway tests
	cd gateway && python -m pytest -q

proto: ## Regenerate gRPC stubs for all languages
	cd core-go && $(MAKE) proto
	./scripts/gen-python-proto.sh
