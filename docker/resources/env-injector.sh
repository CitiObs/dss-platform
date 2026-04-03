#!/bin/bash

echo "====[ ENV-INJECTOR ]===="

TARGET_PATH="$1"

if [ -z "$TARGET_PATH" ] || [ ! -d "$TARGET_PATH" ]; then
    echo "ERROR: Target path '$TARGET_PATH' does not exist or is not a directory"
    exit 1
fi

# Find application js files
JS_FILES=("$TARGET_PATH"/index*.js)
if [ ! -f "${JS_FILES[0]}" ]; then
    echo "ERROR: No index*.js files found in $TARGET_PATH"
    exit 1
fi

# Process ALL matching JS files (code-splitting may produce multiple chunks)
echo "Found ${#JS_FILES[@]} JS file(s) to process"

# Get only VITE_ prefixed environment variables (strict prefix match)
IFS=$'\n'
AVAILABLE_VARIABLES=( $(env | grep '^VITE_' | sed 's/=.*//') )

# Replace values using node for safe escaping (avoids sed injection)
for VAR_NAME in "${AVAILABLE_VARIABLES[@]}" ; do
    echo "Replacing $VAR_NAME"
    VAR_VALUE="${!VAR_NAME}"
    # Use node to safely produce a JSON-escaped string (handles ", \, newlines, etc.)
    SAFE_VALUE=$(node -e "process.stdout.write(JSON.stringify(process.argv[1]).slice(1,-1))" -- "$VAR_VALUE")
    for APP_PATH in "${JS_FILES[@]}"; do
        sed -i -E 's/set\(\s*"'"$VAR_NAME"'"\s*,\s*"[^"]*"\s*\)/set("'"$VAR_NAME"'", "'"$SAFE_VALUE"'")/g' "$APP_PATH"
    done
done

echo "========================"
