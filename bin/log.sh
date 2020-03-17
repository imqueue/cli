#!/bin/bash
# Copyright (c) 2019, imqueue.com <support@imqueue.com>
#
# Permission to use, copy, modify, and/or distribute this software for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#
# THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
# REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
# AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
# INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
# LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
# OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
# PERFORMANCE OF THIS SOFTWARE.
workdir="$HOME/.imq/var"
argv=()

function multitail {
  trap 'kill $(jobs -p) &> /dev/null' EXIT

  args=( "$@" )

  if [[ -z "${args[*]}" ]]; then
    mapfile -t logs < <(find \
    "$workdir" \
    -type f \
    -name "*.log")

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
