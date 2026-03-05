#!/bin/bash
# Syncs transcript.jsonl files from the local workspace repo to S3.
# Uploads new and modified files (by size), skips unchanged.
# Intended to run on a schedule via launchd.

set -euo pipefail

BUCKET="gastown-transcripts"
REGION="us-east-2"
SOURCE_DIR="$HOME/src/github.com/david-seattle/workspace/conversations"
S3_PREFIX="s3://${BUCKET}/conversations/"

if ! command -v aws &>/dev/null; then
    echo "$(date -Iseconds) ERROR: aws CLI not found" >&2
    exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
    echo "$(date -Iseconds) ERROR: source directory not found: $SOURCE_DIR" >&2
    exit 1
fi

# Create bucket if it doesn't exist
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    echo "$(date -Iseconds) Creating bucket $BUCKET in $REGION"
    aws s3api create-bucket \
        --bucket "$BUCKET" \
        --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION"
fi

# Sync only transcript.jsonl files, using size-only comparison
# (transcripts are append-only JSONL, so size change = content change)
aws s3 sync "$SOURCE_DIR" "$S3_PREFIX" \
    --exclude "*" \
    --include "*/transcript.jsonl" \
    --size-only \
    --region "$REGION"

echo "$(date -Iseconds) sync complete (exit=$?)"
