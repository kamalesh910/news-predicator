#!/bin/bash
# =============================================================================
# kafka-init/create-topics.sh
# =============================================================================
# Creates the three required Kafka topics with 3 partitions each.
# Run as a one-shot init container after Kafka is healthy.
# =============================================================================

set -e

KAFKA_BROKER="${KAFKA_BROKERS:-kafka:9092}"

echo "[kafka-init] Waiting for Kafka broker at ${KAFKA_BROKER}..."
until kafka-broker-api-versions --bootstrap-server "${KAFKA_BROKER}" > /dev/null 2>&1; do
  echo "[kafka-init] Kafka not ready yet — retrying in 5s..."
  sleep 5
done
echo "[kafka-init] Kafka is ready."

create_topic() {
  local TOPIC=$1
  local PARTITIONS=${2:-3}
  local REPLICATION=${3:-1}

  if kafka-topics --bootstrap-server "${KAFKA_BROKER}" --list | grep -q "^${TOPIC}$"; then
    echo "[kafka-init] Topic '${TOPIC}' already exists — skipping."
  else
    echo "[kafka-init] Creating topic '${TOPIC}' (partitions=${PARTITIONS}, replication=${REPLICATION})..."
    kafka-topics \
      --bootstrap-server "${KAFKA_BROKER}" \
      --create \
      --topic "${TOPIC}" \
      --partitions "${PARTITIONS}" \
      --replication-factor "${REPLICATION}"
    echo "[kafka-init] Topic '${TOPIC}' created."
  fi
}

create_topic "raw-news"       3 1
create_topic "analyzed-news"  3 1
create_topic "predictions"    3 1

echo "[kafka-init] All topics are ready."
