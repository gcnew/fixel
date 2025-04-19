#!/bin/bash

set -em

# compile the runner
tsc -p test/tsconfig.json

# compile the test index.js
tsc -p test/tsconfig-test-index.json

# this does not work under `npm run` as the script is not run as group leader, see
# https://stackoverflow.com/questions/360201/how-do-i-kill-background-processes-jobs-when-my-shell-script-exits
# trap "kill -- -$$" SIGINT SIGTERM EXIT

trap 'kill $(jobs -pr)' EXIT

# start the server in background
./node_modules/.bin/static-server -p 9090 &

# wait for the server to start
until nc -z localhost 9090 2>/dev/null; do
    sleep 0.01
done

# create the folder for test results
mkdir -p test-results

node built/test/test/runner.js
