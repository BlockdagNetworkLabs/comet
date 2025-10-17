#!/bin/bash

# Script to copy deployment files to e2e template
# Usage: ./scripts/copy-deployment-to-template.sh <network-name>

if [ -z "$1" ]; then
    echo "Error: Network name is required"
    echo "Usage: $0 <network-name>"
    echo "Example: $0 bdag-awakening"
    exit 1
fi

NETWORK_NAME="$1"
SOURCE_DIR="deployments/${NETWORK_NAME}"
DEST_DIR="e2e/_template-${NETWORK_NAME}"

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory '$SOURCE_DIR' does not exist"
    exit 1
fi

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

echo "Copying deployment files from '$SOURCE_DIR' to '$DEST_DIR'..."

# Use rsync to copy with exclusions
rsync -av \
    --exclude='aliases.json' \
    --exclude='roots.json' \
    --exclude='.contracts/' \
    --exclude='.contracts' \
    --exclude='proposalStack.json' \
    --exclude='.gitignore' \
    "$SOURCE_DIR/" "$DEST_DIR/"

if [ $? -eq 0 ]; then
    echo "✓ Successfully copied deployment files to $DEST_DIR"
    echo "  Excluded: aliases.json, roots.json, .contracts/"
else
    echo "✗ Error occurred during copy"
    exit 1
fi

