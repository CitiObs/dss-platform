#!/bin/bash

echo "====[ ENV-INJECTOR ]===="

TARGET_PATH=$1

# Find application js
JS_FILES=($TARGET_PATH/index*.js)
APP_PATH=${JS_FILES[0]}
echo "Found application at: $APP_PATH"

# Get all VITE_ environment variiables
IFS=$'\n' # Change Internal Field Separator to newline
AVAILABLE_VARIABLES=( $(set | grep VITE | sed 's/=.*//') )

# Replace values
for VAR_NAME in ${AVAILABLE_VARIABLES[@]} ; do 
    echo "Replacing $VAR_NAME"
    VAR_VALUE=${!VAR_NAME}
    ESCAPED_VAR_VALUE=$(printf '%s' "$VAR_VALUE" | sed -e 's/[\/&]/\\&/g')
    sed -i -E 's/set\(\s*"'$VAR_NAME'"\s*,\s*"[^"]*"\s*\)/set\("'$VAR_NAME'", "'$ESCAPED_VAR_VALUE'"\)/g' $APP_PATH
done

echo "========================"
