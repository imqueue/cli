#!/bin/bash
# I'm Queue Software Project
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
#
# If you want to use this code in a closed source (commercial) project, you can
# purchase a proprietary commercial license. Please contact us at
# <support@imqueue.com> to get commercial licensing options.
workdir="$HOME/.imq/var"
argv=()

function multitail {
  trap 'kill $(jobs -p) &> /dev/null' EXIT

  args=( "$@" )

  if [[ -z "${args[*]}" ]]; then
	  logs=()

    while IFS= read -r logfile; do
      logs+=("$logfile")
    done < <(find "$workdir" -type f -name "*.log")

    for logfile in "${logs[@]}"; do
      tail -f -n +1 "$logfile" &
    done
  else
    for svc in "${args[@]}"; do
      logfile="$workdir/$svc.log"

      if [[ -f "$logfile" ]]; then
        tail -f -n +1 "$logfile" &
      else
        echo "warn: log-file for service $svc has not been found"
      fi
    done
  fi

  wait
}

function usage {
  echo "Usage: $0 [-hc] [service1, ...serviceN]" >&2
  echo "  [service1, ...serviceN] - list of service repositories directories names to combine logs for, if omitted all existing logs are combined."
  echo "  [-c] - clean previous logs" >&2
  echo "  [-h] - print this usage information" >&2
}

# parse command-line args
while [[ $# -gt 0 ]]; do
  unset OPTIND
  unset OPTARG

  while getopts hc options; do
    case ${options} in
      h) usage ; exit 0 ;;
      c) find "$workdir" -type f -name "*.log" -delete ;;
      \?|*) usage ; exit 1 ;;
    esac
  done

  shift $((OPTIND-1))
  argv+=("$1")
  shift
done

multitail "${argv[@]}"
