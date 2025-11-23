#!/usr/bin/env bash
set -e

# ------------------------------------------------------------------------------
# Codymatch unified setup script
#
# - Checks Node & npm versions
# - Checks Docker & Docker Compose
# - Installs Git hooks from backend/.githooks and frontend/.githooks
#
# Works on Linux, macOS, and Windows via WSL2 / Git Bash.
# This script must be executed from the root of the repository.
# ------------------------------------------------------------------------------

REQUIRED_NODE_MAJOR=25
REQUIRED_NPM_MAJOR=11
MIN_DOCKER_MAJOR=28

# Detect root directory of the repo (independent of current working directory)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------

print_section() {
  echo
  echo "============================================================"
  echo "$1"
  echo "============================================================"
}

# ------------------------------------------------------------------------------
# Node & npm version check
# ------------------------------------------------------------------------------

check_node_and_npm() {
  print_section "Step 1: Checking Node & npm versions"

  if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node is not installed or not in PATH."
    echo "   Please install Node ${REQUIRED_NODE_MAJOR}.x and re-run ./setup.sh."
    exit 1
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm is not installed or not in PATH."
    echo "   Please install npm ${REQUIRED_NPM_MAJOR}.x (or compatible) and re-run ./setup.sh."
    exit 1
  fi

  local node_version npm_version node_major npm_major
  node_version="$(node -v)"  # e.g. v25.2.0
  npm_version="$(npm -v)"    # e.g. 11.0.0

  node_major="${node_version#v}"
  node_major="${node_major%%.*}"
  npm_major="${npm_version%%.*}"

  echo "   Detected node: $node_version"
  echo "   Detected npm:  $npm_version"

  local ok=true

  if [ "$node_major" -ne "$REQUIRED_NODE_MAJOR" ]; then
    echo "❌ Node major version must be ${REQUIRED_NODE_MAJOR}.x, found $node_version"
    ok=false
  fi

  if [ "$npm_major" -ne "$REQUIRED_NPM_MAJOR" ]; then
    echo "❌ npm major version must be ${REQUIRED_NPM_MAJOR}.x, found $npm_version"
    ok=false
  fi

  if [ "$ok" = false ]; then
    echo "   Please align your Node/npm versions and re-run ./setup.sh."
    exit 1
  fi

  echo "✅ Node & npm versions are OK"
}

# ------------------------------------------------------------------------------
# Docker & Docker Compose check
# ------------------------------------------------------------------------------

check_docker_and_compose() {
  print_section "Step 2: Checking Docker & Docker Compose"

  if ! command -v docker >/dev/null 2>&1; then
    echo "❌ docker command not found."
    echo "   Please install Docker (Engine / Desktop) and re-run ./setup.sh."
    exit 1
  fi

  # Get server (Engine) version
  local docker_server_version docker_server_major
  docker_server_version="$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")"
  echo "   Docker server (Engine) version: $docker_server_version"

  docker_server_major="${docker_server_version%%.*}"

  if [ "$docker_server_version" = "unknown" ] || [ -z "$docker_server_major" ]; then
    echo "⚠️  Could not detect Docker server version correctly."
    echo "   Please ensure Docker Engine is properly installed and running."
  else
    if [ "$docker_server_major" -lt "$MIN_DOCKER_MAJOR" ]; then
      echo "❌ Docker Engine is too old. Need >= ${MIN_DOCKER_MAJOR}.x (found $docker_server_version)"
      echo "   Please update Docker Engine and re-run ./setup.sh."
      exit 1
    fi
  fi

  # Compose: prefer plugin `docker compose`
  local compose_cmd compose_version
  if docker compose version >/dev/null 2>&1; then
    compose_cmd="docker compose"
    compose_version="$(docker compose version --short 2>/dev/null || echo "unknown")"
  else
    compose_cmd=""
  fi

  if [ -z "$compose_cmd" ]; then
    echo "❌ Docker Compose (v2) is not available."
    echo "   Please install Docker Compose v2 (docker compose) and re-run ./setup.sh."
    exit 1
  fi

  echo "   Docker Compose command: $compose_cmd"
  echo "   Docker Compose version: $compose_version"
  echo "✅ Docker & Docker Compose are available"
}

# ------------------------------------------------------------------------------
# Git hooks setup
# ------------------------------------------------------------------------------

setup_git_hooks() {
  print_section "Step 3: Installing Git hooks (backend & frontend)"

  if [ ! -d ".git" ]; then
    echo "❌ This directory is not a Git repository (no .git folder)."
    echo "   Please run ./setup.sh from the root of the Codymatch repository."
    exit 1
  fi

  local dst_dir=".git/hooks"
  mkdir -p "$dst_dir"

  local any_hooks=false

  for hook_dir in "backend/.githooks" "frontend/.githooks"; do
    if [ -d "$hook_dir" ]; then
      echo "   Installing hooks from $hook_dir"
      for hook in "$hook_dir"/*; do
        [ -f "$hook" ] || continue
        local hook_name
        hook_name="$(basename "$hook")"
        cp "$hook" "$dst_dir/$hook_name"
        chmod +x "$dst_dir/$hook_name"
        any_hooks=true
      done
    fi
  done

  if [ "$any_hooks" = true ]; then
    echo "✅ Git hooks installed into .git/hooks"
  else
    echo "ℹ️  No .githooks found in backend/ or frontend/, skipping."
  fi
}

# ------------------------------------------------------------------------------
# Main
# ------------------------------------------------------------------------------

main() {
  echo "Codymatch unified setup"
  echo "Root directory: $ROOT_DIR"
  echo "Note: this script is intended to run in a POSIX shell"
  echo "      (Linux, macOS, WSL2, or Git Bash on Windows)."

  check_node_and_npm
  check_docker_and_compose
  setup_git_hooks

  print_section "All checks completed"
  echo "✅ Your local environment looks good."
  echo "Next steps:"
  echo "  1. Go to the docker folder:   cd docker"
  echo "  2. Start the dev environment: ./codymatch.sh bul"
  echo
  echo "Reminder:"
  echo "  Avoid running 'npm install' directly on your host."
  echo "  Prefer running npm commands through the docker helper:"
  echo "    cd docker"
  echo "    ./codymatch.sh backend npm install <package>"
  echo "    ./codymatch.sh frontend npm install <package>"
  echo
}

main "$@"
