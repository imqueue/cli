#!/bin/bash
# Copyright (C) 2025  imqueue.com <support@imqueue.com>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
program="$0 $*"
cwd=$(pwd)
workdir="$HOME/.imq/var"
pidfile="$workdir/.pids"
argv=()
path="."
services=()
update=0
calm=0
verbose=0
warnmsg=""

function wait_service {
  local svc="$1"
  local logfile="$workdir/$svc.log"
  local file errfile

  file=$(grep 'reader channel connected' "$logfile")

  if [[ -z "$file" ]]; then
    errfile=$(grep 'UnhandledPromiseRejectionWarning:' "$logfile")

    if [[ -z "$errfile" ]]; then
      sleep 1
      wait_service "$svc"
    else
      warnmsg="warn: service $svc errored, please, consider watching logs..."
    fi
  fi
}

function start_services {
  local dir="$1"
  local pid svc

  if [[ ! -d "$dir" ]]; then
    echo "No such directory: $dir" >&2
    exit 1
  fi

  for svc in "${services[@]}"; do
      cd "$dir/$svc" || exit 1

      if [[ 1 -eq ${update} ]]; then
        echo "Updating $svc..."
        git pull || exit 1
      fi

      printf "Starting %s" "$svc"

      if [[ $(npm run --silent dev &> "$workdir/$svc.log") ]] & pid="$!"; then
        :
      fi

      if [[ 1 -eq "$calm" ]]; then
        wait_service "$svc"
      fi

      printf ", master pid is %d...\n" ${pid}
      touch "$pidfile"
      echo "$svc:$pid" >> "$pidfile"

      if [[ -n "$warnmsg" ]]; then
        echo "$warnmsg"
        warnmsg=""
      fi

      cd "$cwd" || exit 1
  done

  if [[ 0 -eq "$calm" ]]; then
    echo "Bulk service start initiated, please, be patient..."
  fi
}

function trim {
    local str="$*"

    str="${str#"${str%%[![:space:]]*}"}"
    str="${str%"${str##*[![:space:]]}"}"

    printf '%s' "$str"
}

function pids_list {
  local pid pids child_pid

  pid=$(trim "$1")

  if [[ -z "$pid" ]]; then
    return 0
  fi

  echo "$pid"

  pids=()
  while IFS= read -r line; do
    pids+=("$line")
  done < <(ps -ax -o pid,ppid | awk -v ppid="$pid" '$2 == ppid {print $1}')

  if [[ ! 0 -eq "${#pids[@]}" ]]; then
    for child_pid in "${pids[@]}"; do
      child_pid=$(trim "$child_pid")

      if [[ -n "$child_pid" ]]; then
        pids_list "$child_pid"
      fi
    done
  fi
}

function stop_services {
  local dir="$1"
  local pids present svc svc_name pid parts info

  if [[ -f "$pidfile" ]]; then
    while IFS= read -r info; do
      IFS=':' read -r -a parts <<< "$info"
      svc_name="${parts[0]}"
      pid="${parts[1]}"
      present=$(in_services "$svc_name")

      if [[ 0 -eq ${present} ]]; then
        echo "$svc_name:$pid" >> "${pidfile}.lock"
        continue
      fi

      pids=()
      while IFS= read -r line; do
        pids+=("$line")
      done < <(pids_list "$pid")

      echo "Stopping ${svc_name} by pids ${pids[*]}"
      kill -s TERM "${pids[@]}" &> /dev/null
    done < "$pidfile"

    rm "$pidfile"

    if [[ -f "${pidfile}.lock" ]]; then
      mv "${pidfile}.lock" "$pidfile"
    fi
  fi

  for svc in "${services[@]}"; do
    cd "$dir/$svc" || exit 1

    if [[ $(npm run --silent stop) ]] &> /dev/null; then
      :
    fi

    cd "$cwd" || exit 1
  done
}

function usage {
  echo "Usage: $0 <command> [-p path] [-s services] [-hu]" >&2
  echo "  <command> is one of start|stop|restart" >&2
  echo "  [-p path] - path to a directory with services repositories, by default is current directory" >&2
  echo "  [-s services] - comma-separated services list (repositories names), if not passed will scan path for a services presence" >&2
  echo "  [-u] - if passed service will be updated using 'git pull' before start" >&2
  echo "  [-c] - calm down services start - wait before staring next" >&2
  echo "  [-v] - verbose mode, shows command execution time" >&2
  echo "  [-h] - print this usage information" >&2
}

function in_services {
  local service_name="$1"
  local service_list_lookup=" ${services[*]} "
  local service_name_lookup=" ${service_name} "

  if [[ "$service_list_lookup" =~ $service_name_lookup ]]; then
    echo 1
  else
    echo 0
  fi
}

# parse command-line args
while [[ $# -gt 0 ]]; do
  unset OPTIND
  unset OPTARG

  while getopts hucvp:s: options; do
    case ${options} in
      p) path="$OPTARG" ;;
      s) IFS=',' read -ra services <<< "$OPTARG" ;;
      h) usage ; exit 0 ;;
      u) update=1 ;;
      c) calm=1 ;;
      v) verbose=1 ;;
      \?|*) usage ; exit 1 ;;
    esac
  done

  shift $((OPTIND-1))
  argv+=("$1")
  shift
done

# load services from path if they were not provided by command-line option

if [[ 0 -eq "${#services[@]}" ]]; then
  # MacOSX patch, as long as it does not compatible with linux's grep -P
  if command -v perl >/dev/null 2>&1; then
    service_entries=()

    while IFS= read -r -d '' file; do
      service_entries+=("$file")
    done < <(find \
      "$path"/*/src \
      -type f \
      -name "*.ts" \
      -exec perl -lne \
        'print $ARGV if /extends\s+IMQ(Service|Client)\s*\{/' \
        {} + 2>/dev/null | tr '\n' '\0'
    )

    for file in "${service_entries[@]}"; do
      IFS='/' read -ra file_path <<< "${file#${path}/}"
      service_name="${file_path[0]}"
      present=$(in_services "$service_name")

      if [[ 0 -eq ${present} ]]; then
        services+=( "$service_name" )
      fi
    done
  else
    mapfile -t service_entries < <(find \
      "$path"/*/src \
      -type f \
      -name "*.ts" \
      -exec grep -lP 'extends\s+IMQ(Service|Client)\s*\{' {} +)

    for file in "${service_entries[@]}"; do
      IFS='/' read -ra file_path <<< "${file#${path}/}"
      service_name="${file_path[0]}"
      present=$(in_services "$service_name")

      if [[ 0 -eq ${present} ]]; then
        services+=( "$service_name" )
      fi
    done
  fi
fi

# make sure workdir exists to store pids
if [[ ! -d "$workdir" ]]; then
  mkdir -p "$workdir" || exit 1
fi

# check if command passed
if [[ -z "${argv[0]}" ]]; then
  echo "Command expected, but not given!" >&2
  usage
  exit 1
fi

# do the job
start=$(date +%s)

case "${argv[0]}" in
  start)
    (start_services "$path")
    ;;
  stop)
    (stop_services "$path")
    ;;
  restart)
    (stop_services "$path")
    (start_services "$path")
    ;;
esac

end=$(date +%s)
runtime=$((end - start))

if [[ 1 -eq "$verbose" ]]; then
  echo "Command '$program' executed in ${runtime} sec."
fi
