# PrivyQ — top-level developer tasks.
COMPOSE := docker compose -f deploy/docker-compose.yml
PY      := python
SDK_DIR := sdk-python

.PHONY: help dev up down logs build test proto core-test sdk-test gateway-test \
        sdk-tools sdk-proto sdk-dist sdk-check sdk-publish-test sdk-publish sdk-clean

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

# ─────────────────────────── SDK packaging (PyPI) ───────────────────────────
# Publishing needs an API token. Set it once per shell (recommended):
#   export TWINE_USERNAME=__token__
#   export TWINE_PASSWORD=pypi-<your-api-token>
# or configure ~/.pypirc. Always publish to TestPyPI first (sdk-publish-test).

sdk-tools: ## Install the packaging toolchain (build + twine)
	$(PY) -m pip install --upgrade build twine

sdk-proto: ## Ensure the SDK's generated gRPC stubs are up to date
	./scripts/gen-python-proto.sh

sdk-dist: sdk-tools sdk-proto sdk-clean ## Build the SDK sdist + wheel into sdk-python/dist
	cd $(SDK_DIR) && $(PY) -m build
	@echo "built:" && ls -1 $(SDK_DIR)/dist

sdk-check: ## Validate the built artifacts (metadata, README rendering)
	cd $(SDK_DIR) && $(PY) -m twine check dist/*

sdk-publish-test: sdk-check ## Upload the SDK to TestPyPI (dry run for real releases)
	cd $(SDK_DIR) && $(PY) -m twine upload --repository testpypi dist/*
	@echo "verify:  pip install -i https://test.pypi.org/simple/ privyq"

sdk-publish: sdk-check ## Upload the SDK to PyPI (real release — needs a fresh version)
	@printf "About to publish privyq to \033[1mPyPI\033[0m. Ctrl-C to abort, Enter to continue: " && read _
	cd $(SDK_DIR) && $(PY) -m twine upload dist/*
	@echo "published:  pip install privyq"

sdk-clean: ## Remove SDK build artifacts
	rm -rf $(SDK_DIR)/dist $(SDK_DIR)/build $(SDK_DIR)/*.egg-info
