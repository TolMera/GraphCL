#!/bin/bash

# Default values
CONTAINER_NAME="neo4j"
NEO4J_PORT="7474"
BOLT_PORT="7687"
DATA_DIR="$HOME/neo4j/data"
LOGS_DIR="$HOME/neo4j/logs"
username="neo4j"
password="password"
IMAGE="neo4j:community"

# Input parameters with default fallback
CONTAINER_NAME="${1:-$CONTAINER_NAME}"
NEO4J_PORT="${2:-$NEO4J_PORT}"
BOLT_PORT="${3:-$BOLT_PORT}"
DATA_DIR="${4:-$DATA_DIR}"
LOGS_DIR="${5:-$LOGS_DIR}"
username="${6:-$username}"
password="${7:-$password}"
IMAGE="${8:-$IMAGE}"

echo "Container Name: $CONTAINER_NAME"
echo "HTTP Port: $NEO4J_PORT"
echo "Bolt Port: $BOLT_PORT"
echo "Data Directory: $DATA_DIR"
echo "Logs Directory: $LOGS_DIR"
echo "username: $username"
echo "password: $password"
echo "Image: $IMAGE"

# Check if the container exists
if [ "$(docker ps -a -q -f name=$CONTAINER_NAME)" ]; then
    echo "Container $CONTAINER_NAME exists. Restarting it..."
    docker start "$CONTAINER_NAME"
else
    echo "Creating and starting a new container $CONTAINER_NAME..."
    docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$NEO4J_PORT":7474 -p "$BOLT_PORT":7687 \
    -v "$DATA_DIR":/data \
    -v "$LOGS_DIR":/logs \
    -e NEO4J_AUTH="$username/$password" \
    "$IMAGE"
fi
