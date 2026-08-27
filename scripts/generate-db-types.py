#!/usr/bin/env python3
"""
Generate src/types/database.ts from a live PostgreSQL schema.

Used to produce the committed type definitions from the migrations in
supabase/migrations. In a project with the Supabase CLI available you would
instead run:

    supabase gen types typescript --local > src/types/database.ts

This script exists so the types can be regenerated from the migrations alone,
with no Supabase project and no network access.
"""
import subprocess
import sys
from collections import defaultdict

BASE = "/var/tmp/pgvalidate"
SQL_FILE = f"{BASE}/_introspect.sql"
SEPARATOR = "|~|"


def query(sql: str):
    """Run SQL as the postgres user. The statement is written to a file rather
    than passed inline, so quoting survives the `su -c` shell hop intact."""
    with open(SQL_FILE, "w") as fh:
        fh.write(sql)
    subprocess.run(["chown", "postgres:postgres", SQL_FILE], check=True)
    out = subprocess.run(
        [
            "su", "postgres", "-c",
            f"psql -h {BASE}/run -p 5433 -U postgres -d appdb -tA -F'{SEPARATOR}' -f {SQL_FILE}",
        ],
        capture_output=True,
        text=True,
    )
    if out.returncode != 0:
        sys.exit(f"query failed: {out.stderr}")
    return [line.split(SEPARATOR) for line in out.stdout.strip().split("\n") if line]


TYPE_MAP = {
    "uuid": "string", "text": "string", "citext": "string", "varchar": "string",
    "bpchar": "string", "char": "string", "inet": "string", "date": "string",
    "timestamptz": "string", "timestamp": "string", "time": "string",
    "int2": "number", "int4": "number", "int8": "number",
    "float4": "number", "float8": "number",
    # NUMERIC arrives from PostgREST as a STRING to preserve precision.
    # This is deliberate: money must never become a float on the way in.
    "numeric": "string",
    "bool": "boolean", "jsonb": "Json", "json": "Json",
    "bytea": "string",
}


def ts_type(udt: str, enums: dict) -> str:
    array = udt.startswith("_")
    base = udt[1:] if array else udt
    if base in enums:
        mapped = f"Enums['{base}']"
    else:
        mapped = TYPE_MAP.get(base, "string")
    return f"{mapped}[]" if array else mapped


def main() -> None:
    enum_rows = query(
        "select t.typname, e.enumlabel from pg_type t "
        "join pg_enum e on e.enumtypid = t.oid "
        "join pg_namespace n on n.oid = t.typnamespace "
        "where n.nspname = 'public' order by t.typname, e.enumsortorder"
    )
    enums = defaultdict(list)
    for name, label in enum_rows:
        enums[name].append(label)

    # Domains (money_amount, currency_code, percentage) resolve to their base type.
    domain_rows = query(
        "select t.typname, bt.typname from pg_type t "
        "join pg_type bt on bt.oid = t.typbasetype "
        "join pg_namespace n on n.oid = t.typnamespace "
        "where n.nspname = 'public' and t.typtype = 'd'"
    )
    domains = {name: base for name, base in domain_rows}

    col_rows = query(
        "select c.relname, a.attname, "
        "  coalesce(bt.typname, t.typname) as udt, "
        "  a.attnotnull, "
        "  (a.atthasdef and pg_get_expr(d.adbin, d.adrelid) is not null) as has_default, "
        "  a.attidentity <> '' or a.attgenerated <> '' as is_generated, "
        "  c.relkind "
        "from pg_attribute a "
        "join pg_class c on c.oid = a.attrelid "
        "join pg_namespace n on n.oid = c.relnamespace "
        "join pg_type t on t.oid = a.atttypid "
        "left join pg_type bt on bt.oid = t.typbasetype and t.typtype = 'd' "
        "left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum "
        "where n.nspname = 'public' and c.relkind in ('r','v') "
        "  and a.attnum > 0 and not a.attisdropped "
        "order by c.relname, a.attnum"
    )

    # Foreign keys become PostgREST "Relationships", which is what makes
    # embedded selects such as .select("*, agents(*)") type-check.
    fk_rows = query(
        "select con.conname, src.relname, "
        "  (select string_agg(a.attname, ',' order by k.ord) "
        "     from unnest(con.conkey) with ordinality k(attnum, ord) "
        "     join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum), "
        "  tgt.relname, "
        "  (select string_agg(a.attname, ',' order by k.ord) "
        "     from unnest(con.confkey) with ordinality k(attnum, ord) "
        "     join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum), "
        "  exists ( "
        "    select 1 from pg_index i "
        "     where i.indrelid = con.conrelid and i.indisunique "
        "       and i.indkey::int2[] @> con.conkey and con.conkey @> i.indkey::int2[] "
        "  ) as is_one_to_one "
        "from pg_constraint con "
        "join pg_class src on src.oid = con.conrelid "
        "join pg_class tgt on tgt.oid = con.confrelid "
        "join pg_namespace n on n.oid = src.relnamespace "
        "where con.contype = 'f' and n.nspname = 'public' "
        "order by src.relname, con.conname"
    )
    relationships = defaultdict(list)
    for conname, src, cols, tgt, refcols, one_to_one in fk_rows:
        relationships[src].append(
            {
                "name": conname,
                "columns": cols.split(","),
                "referencedRelation": tgt,
                "referencedColumns": refcols.split(","),
                "isOneToOne": one_to_one == "t",
            }
        )

    tables = defaultdict(list)
    kinds = {}
    for rel, col, udt, notnull, has_def, generated, relkind in col_rows:
        kinds[rel] = relkind
        tables[rel].append(
            {
                "name": col,
                "udt": udt,
                "notnull": notnull == "t",
                "has_default": has_def == "t",
                "generated": generated == "t",
            }
        )

    lines = [
        "/**",
        " * Database types.",
        " *",
        " * GENERATED FILE - do not edit by hand.",
        " *",
        " * Regenerate after changing supabase/migrations with either:",
        " *   supabase gen types typescript --local > src/types/database.ts",
        " * or, with no Supabase project available:",
        " *   python3 scripts/generate-db-types.py",
        " *",
        " * Note on money: `numeric` columns are typed as `string`, because that is",
        " * what PostgREST returns and because parsing them into a JavaScript number",
        " * would reintroduce exactly the floating-point error that lib/domain/money.ts",
        " * exists to prevent. Convert with fromMajor() at the boundary.",
        " */",
        "",
        "export type Json =",
        "  | string",
        "  | number",
        "  | boolean",
        "  | null",
        "  | { [key: string]: Json | undefined }",
        "  | Json[];",
        "",
        "export interface Database {",
        "  public: {",
        "    Tables: {",
    ]

    def emit_relationships(rels):
        if not rels:
            return ["        Relationships: [];"]
        out = ["        Relationships: ["]
        for rel in rels:
            cols = ", ".join(f'"{c}"' for c in rel["columns"])
            refs = ", ".join(f'"{c}"' for c in rel["referencedColumns"])
            out.append("          {")
            out.append(f'            foreignKeyName: "{rel["name"]}";')
            out.append(f"            columns: [{cols}];")
            out.append(f'            isOneToOne: {"true" if rel["isOneToOne"] else "false"};')
            out.append(f'            referencedRelation: "{rel["referencedRelation"]}";')
            out.append(f"            referencedColumns: [{refs}];")
            out.append("          },")
        out.append("        ];")
        return out

    def emit_columns(cols, mode):
        out = []
        for col in cols:
            t = ts_type(col["udt"], enums)
            nullable = not col["notnull"]
            if mode == "Row":
                optional = ""
                type_text = f"{t} | null" if nullable else t
            elif mode == "Insert":
                # Optional when nullable, defaulted or generated. `reference_code`
                # is additionally optional because a BEFORE INSERT trigger
                # assigns it (see next_reference() in migration 0010); the
                # column is NOT NULL but callers must not supply it.
                trigger_assigned = col["name"] == "reference_code"
                optional = (
                    "?"
                    if (nullable or col["has_default"] or col["generated"] or trigger_assigned)
                    else ""
                )
                type_text = f"{t} | null" if nullable else t
            else:  # Update
                optional = "?"
                type_text = f"{t} | null" if nullable else t
            out.append(f"          {col['name']}{optional}: {type_text};")
        return out

    for rel in sorted(tables):
        if kinds[rel] != "r":
            continue
        cols = tables[rel]
        lines.append(f"      {rel}: {{")
        lines.append("        Row: {")
        lines += emit_columns(cols, "Row")
        lines.append("        };")
        lines.append("        Insert: {")
        lines += emit_columns([c for c in cols if not c["generated"]], "Insert")
        lines.append("        };")
        lines.append("        Update: {")
        lines += emit_columns([c for c in cols if not c["generated"]], "Update")
        lines.append("        };")
        lines += emit_relationships(relationships.get(rel, []))
        lines.append("      };")

    lines.append("    };")
    lines.append("    Views: {")
    for rel in sorted(tables):
        if kinds[rel] != "v":
            continue
        lines.append(f"      {rel}: {{")
        lines.append("        Row: {")
        lines += emit_columns(tables[rel], "Row")
        lines.append("        };")
        lines += emit_relationships([])
        lines.append("      };")
    lines.append("    };")

    # supabase-js requires Functions and CompositeTypes to be present for the
    # schema generic to match; without them every query resolves to `never`.
    lines.append("    Functions: {")
    lines.append("      [key: string]: {")
    lines.append("        Args: Record<string, unknown>;")
    lines.append("        Returns: unknown;")
    lines.append("      };")
    lines.append("    };")
    lines.append("    CompositeTypes: {")
    lines.append("      [key: string]: never;")
    lines.append("    };")
    lines.append("    Enums: {")
    for name in sorted(enums):
        values = " | ".join(f'"{v}"' for v in enums[name])
        lines.append(f"      {name}: {values};")
    lines.append("    };")
    lines.append("  };")
    lines.append("}")
    lines.append("")

    lines += [
        "export type Enums = Database['public']['Enums'];",
        "export type Tables = Database['public']['Tables'];",
        "export type Views = Database['public']['Views'];",
        "",
        "export type Row<T extends keyof Tables> = Tables[T]['Row'];",
        "export type Insert<T extends keyof Tables> = Tables[T]['Insert'];",
        "export type Update<T extends keyof Tables> = Tables[T]['Update'];",
        "",
    ]

    with open("src/types/database.ts", "w") as fh:
        fh.write("\n".join(lines))

    table_count = sum(1 for r in tables if kinds[r] == "r")
    print(f"generated {table_count} tables, {len(enums)} enums, {len(domains)} domains")


if __name__ == "__main__":
    main()
