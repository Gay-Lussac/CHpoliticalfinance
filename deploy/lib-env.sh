# Source this file to load .env LITERALLY (no shell expansion): values may contain spaces, $, quotes…
# Same rules as the Python and Node loaders: KEY=VALUE per line, first '=' splits, # comments ignored.
load_env() {
  local file="${1:-.env}" line key
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"; key="${key//[[:space:]]/}"
    [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    export "$key=${line#*=}"
  done < "$file"
}
