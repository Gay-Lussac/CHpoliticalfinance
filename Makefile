# Local development shortcuts. See README.md › Run locally.
PY := pipeline/.venv/bin

.PHONY: setup db db-reset sync sync-full rebuild check review api web build serve test

setup:            ## install everything (needs: brew install mariadb node; brew services start mariadb)
	test -f .env || (echo "create .env from .env.example first" && exit 1)
	python3 -m venv pipeline/.venv && $(PY)/pip install -q -e pipeline
	npm --prefix api install && npm --prefix web install
	db/scripts/create_local_db.sh

db:               ## create DB/users if missing, apply migrations + views
	db/scripts/create_local_db.sh
db-reset:         ## drop and recreate the DB (then run `make rebuild`)
	db/scripts/create_local_db.sh --reset

sync:             ## fetch what changed at the EFK and load it
	$(PY)/pipeline sync
sync-full:        ## refetch every declaration (first run / after long pause)
	$(PY)/pipeline sync --full --trigger backfill
rebuild:          ## reload the DB from the raw archive (no network)
	$(PY)/pipeline rebuild
check:
	$(PY)/pipeline check
review:           ## list possible duplicate donors
	$(PY)/pipeline resolve --review

api:              ## API on http://127.0.0.1:8787 (also serves web/dist if built)
	npm --prefix api run dev
web:              ## front-end dev server on http://localhost:5173 (proxies /api)
	npm --prefix web run dev
build:            ## production build of the front-end into web/dist
	npm --prefix web run build
serve: build      ## single process: site + API on http://127.0.0.1:8787
	npm --prefix api start

test:
	cd pipeline && .venv/bin/python -m unittest discover -s tests -q
	npm --prefix api test
	cd web && npx tsc --noEmit
