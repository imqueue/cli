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
argv=()
services=()
path="."
cwd="$(pwd)"
v_type="prerelease"
do_commit=0
do_not_update=0

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

function usage {
    echo "Usage: $0 [-hcu] [-p path] [-s services] [-v type]" >&2
    echo "  Performs dependencies update on services located under given path" >&2
    echo "  Before running this command, make sure services are not in dirty git state" >&2
    echo "  [-h] - print this usage information" >&2
    echo "  [-v type] - set new version using one of typed: major|minor|path|prerelease. By default is prerelease" >&2
    echo "  [-c] - if specified it will try to do commit and push" >&2
    echo "  [-u] - if specified will do not update update deps, and performs other tasks only" >&2
    echo "  [-p path] - path to a directory with services repositories, by default is current directory" >&2
    echo "  [-s services] - comma-separated services list (repositories names), if not passed will scan path for a services presence"
}

# parse command-line args
while [[ $# -gt 0 ]]; do
    unset OPTIND
    unset OPTARG

    while getopts hucvp:s: options; do
        case ${options} in
            p) path="$OPTARG" ;;
            c) do_commit=1 ;;
            u) do_not_update=1 ;;
            s) IFS=',' read -ra services <<< "$OPTARG" ;;
            v) v_type="${OPTARG}" ;;
            h) usage ; exit 0 ;;
            \?|*) usage ; exit 1 ;;
        esac
    done

    shift $((OPTIND-1))
    argv+=("$1")
    shift
done

# load services from path if they were not provided by command-line option
if [[ 0 -eq "${#services[@]}" ]]; then
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

if ! [[ -x "$(command -v npm-check-updates)" ]]; then
    npm i -g npm-check-updates || exit 1
fi

if [[ do_commit -eq 0 && do_not_update -eq 1 ]]; then
    echo "Nothing to perform, suggest do update and/or commit." >&2
    usage
    exit 1
fi

for svc in "${services[@]}"; do
    dir="${path}/${svc}"

    cd ${dir}

    if [[ do_not_update -ne 1 ]]; then
        git pull || exit 1
        ncu -u
        rm -rf node_modules package-lock.json
        npm i
    fi

    if [[ do_commit -eq 1 ]]; then
        if [[ $(git diff --stat) != '' ]]; then
            git commit -am "chore: dependencies update"

            case "${v_type}" in
                minor|major|patch|prerelease) ;;
                *) v_type="prerelease"
            esac

            npm version "$v_type"
            git push --follow-tags
        fi
    fi

    cd ${cwd}
done
