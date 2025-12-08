#!/bin/sh
set -e

# Get user and group IDs from environment or use defaults
USERID=${USERID:-1000}
GROUPID=${GROUPID:-1000}

# Fix Docker socket permissions (allow non-root user to access)
# Only works if we're running as root
if [ "$(id -u)" = "0" ] && [ -S /var/run/docker.sock ]; then
  chmod 666 /var/run/docker.sock 2>/dev/null || true
fi

# Fix code runner temp directory permissions if it exists
# Only works if we're running as root
if [ "$(id -u)" = "0" ] && [ -d /tmp/code-runner ]; then
  chmod 777 /tmp/code-runner 2>/dev/null || true
  chown -R "${USERID}:${GROUPID}" /tmp/code-runner 2>/dev/null || true
fi

# Switch to the specified user and execute the command
if [ "$(id -u)" = "0" ] && [ -n "$1" ]; then
  # We're root, switch to the user and execute
  exec su-exec "${USERID}:${GROUPID}" "$@"
else
  # Already running as the user, just execute
  exec "$@"
fi

