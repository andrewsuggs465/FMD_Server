#!/usr/bin/env bash

# Needed because config.yaml does not have this path set
export FMD_DATABASEDIR="${SNAP_COMMON}/db"

# Run the tool
exec "${SNAP}/bin/fmd-server-ctl" "$@"