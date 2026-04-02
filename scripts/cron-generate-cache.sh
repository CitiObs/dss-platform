#!/bin/bash
# Cron script to regenerate sensor cache
# 
# Supports two modes:
#   - Full scan (default): Updates ALL sensors (~30-40 min with parallel processing)
#   - Quick update (--quick): Only active sensors (~5-10 min)
#
# RECOMMENDED CRON SETUP (add to crontab -e):
#   # Quick incremental updates every hour
#   15 * * * * /path/to/cron-generate-cache.sh --quick >> /var/log/sensor-cache.log 2>&1
#   
#   # Full scan every 6 hours (catches new inactive sensors)
#   0 */6 * * * /path/to/cron-generate-cache.sh >> /var/log/sensor-cache.log 2>&1
#
# For Docker production (add to host's crontab):
#   15 * * * * /path/to/cron-generate-cache.sh --quick >> /var/log/sensor-cache.log 2>&1
#   0 */6 * * * /path/to/cron-generate-cache.sh >> /var/log/sensor-cache.log 2>&1

set -e

# Parse arguments
QUICK_MODE=""
if [ "$1" = "--quick" ]; then
    QUICK_MODE="--quick"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"
LOCK_FILE="/tmp/sensor-cache-generation.lock"

# All metrics to process
METRICS="airTemperature relativeHumidity atmosphericPressure pm25 pm10 no2"

# Lock timeout: 30 min for quick mode, 2 hours for full scan
if [ -n "$QUICK_MODE" ]; then
    LOCK_TIMEOUT=1800  # 30 minutes
    MODE_NAME="QUICK"
else
    LOCK_TIMEOUT=7200  # 2 hours
    MODE_NAME="FULL"
fi

# Prevent overlapping runs
if [ -f "$LOCK_FILE" ]; then
    LOCK_AGE=$(($(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)))
    if [ "$LOCK_AGE" -lt "$LOCK_TIMEOUT" ]; then
        echo "$LOG_PREFIX WARNING: Previous cache generation still running (lock age: ${LOCK_AGE}s). Skipping $MODE_NAME update."
        exit 0
    else
        echo "$LOG_PREFIX WARNING: Stale lock file found (age: ${LOCK_AGE}s). Removing and continuing..."
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file
echo "$$" > "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

echo "$LOG_PREFIX Starting $MODE_NAME sensor cache generation (parallel)..."
echo "$LOG_PREFIX Metrics: $METRICS"
START_TIME=$(date +%s)

# Option 1: If running inside Docker (production)
if command -v docker &> /dev/null && docker ps | grep -q "co-frontend"; then
    echo "$LOG_PREFIX Running in Docker container (parallel mode)..."
    
    # Start all metrics in parallel
    PIDS=""
    for metric in $METRICS; do
        echo "$LOG_PREFIX   Starting $metric $QUICK_MODE..."
        docker exec co-frontend-co-frontend-1 node /app/scripts/generate-sensor-cache.js $metric $QUICK_MODE > /tmp/cache-$metric.log 2>&1 &
        PIDS="$PIDS $!"
    done
    
    # Wait for all to complete
    echo "$LOG_PREFIX Waiting for all metrics to complete..."
    FAILED=0
    for pid in $PIDS; do
        if ! wait $pid; then
            FAILED=$((FAILED + 1))
        fi
    done
    
    if [ $FAILED -gt 0 ]; then
        echo "$LOG_PREFIX WARNING: $FAILED metric(s) failed. Check /tmp/cache-*.log for details."
    fi
    
# Option 2: If running directly with Node.js
elif command -v node &> /dev/null; then
    echo "$LOG_PREFIX Running with local Node.js (parallel mode)..."
    cd "$PROJECT_DIR"
    
    # Start all metrics in parallel
    PIDS=""
    for metric in $METRICS; do
        echo "$LOG_PREFIX   Starting $metric $QUICK_MODE..."
        node scripts/generate-sensor-cache.js $metric $QUICK_MODE > /tmp/cache-$metric.log 2>&1 &
        PIDS="$PIDS $!"
    done
    
    # Wait for all to complete
    echo "$LOG_PREFIX Waiting for all metrics to complete..."
    FAILED=0
    for pid in $PIDS; do
        if ! wait $pid; then
            FAILED=$((FAILED + 1))
        fi
    done
    
    if [ $FAILED -gt 0 ]; then
        echo "$LOG_PREFIX WARNING: $FAILED metric(s) failed. Check /tmp/cache-*.log for details."
    fi
    
else
    echo "$LOG_PREFIX ERROR: Neither Docker nor Node.js found!"
    exit 1
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo "$LOG_PREFIX $MODE_NAME cache generation completed in ${MINUTES}m ${SECONDS}s!"
echo "$LOG_PREFIX Cache files:"
ls -lh "$PROJECT_DIR/public/sensor-cache/"*.json 2>/dev/null || docker exec co-frontend-co-frontend-1 ls -lh /app/public/sensor-cache/ 2>/dev/null || echo "  (check container)"

exit 0
