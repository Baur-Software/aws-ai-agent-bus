ENV ?= dev
WS ?= small/kv_store

.PHONY: help init plan apply destroy fmt lint

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

init: ## terraform init selected workspace
	@cd infra/workspaces/$(WS) && terraform init

plan: ## terraform plan selected workspace
	@cd infra/workspaces/$(WS) && terraform plan -var env=$(ENV)

apply: ## terraform apply selected workspace
	@cd infra/workspaces/$(WS) && terraform apply -auto-approve -var env=$(ENV)

destroy: ## terraform destroy selected workspace
	@cd infra/workspaces/$(WS) && terraform destroy -auto-approve -var env=$(ENV)

fmt: ## format terraform files
	@terraform fmt -recursive

lint: ## lint terraform files
	@.tooling/lint.sh