#!/usr/bin/env bash
# Regenerates supabase/schema.sql from supabase/migrations/.
#
# The consolidated file exists for the Supabase SQL-editor workflow. It is a
# convenience, not the source of truth: supabase/migrations/ remains canonical
# and is what `supabase db push` applies.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
import glob, io

out = io.StringIO()
out.write(open("scripts/schema-header.sql").read())
for path in sorted(glob.glob("supabase/migrations/*.sql")):
    out.write("\n-- %s\n" % ("=" * 75))
    out.write("-- SOURCE: %s\n" % path)
    out.write("-- %s\n\n" % ("=" * 75))
    out.write(open(path).read())
    out.write("\n")

with open("supabase/schema.sql", "w") as fh:
    fh.write(out.getvalue())
print("supabase/schema.sql regenerated from %d migrations" % len(glob.glob("supabase/migrations/*.sql")))
PY
