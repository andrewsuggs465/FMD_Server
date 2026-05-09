#!/usr/bin/env bash

FMD_DATABASEDIR="${SNAP_COMMON}/db"

# Start FMD Server
exec "${SNAP}/bin/fmd-server-ctl" "$@"