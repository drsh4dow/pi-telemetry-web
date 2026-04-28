#!/bin/sh
set -eu

if [ "${DATABASE_BACKEND:-local}" = "local" ]; then
	data_dir="${DATA_DIR:-/data}"
	db_path="${DB_PATH:-$data_dir/pi-telemetry-web.sqlite}"

	case "$db_path" in
		file:*) db_path="${db_path#file:}" ;;
	esac

	db_dir="$(dirname "$db_path")"
	mkdir -p "$db_dir"
	chown -R app:app "$db_dir"
fi

exec su-exec app "$@"
