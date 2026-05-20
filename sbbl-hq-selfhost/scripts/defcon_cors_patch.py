#!/usr/bin/env python3
"""
DEFCON PATCH V2 — Active Kong CORS fix
Discovers the Docker-mounted kong.yml from the running supabase-kong container,
patches bare `- name: cors` entries on all auth routes to include the full
20-header allowlist + sbbl-hq.icu origin, then reports status.

Run from any directory:
  python defcon_cors_patch.py [--dry-run]

Does NOT restart Kong — do that manually after confirming GREEN:
  cd <ActiveRoot> && docker compose up -d --force-recreate kong
"""

import re, subprocess, sys, shutil, datetime, json, os, argparse

AUTH_SERVICES = {
    'auth-v1-open', 'auth-v1-open-callback', 'auth-v1-open-authorize',
    'auth-v1-open-jwks', 'auth-v1-open-health', 'auth-v1-open-sso-acs',
    'auth-v1-open-sso-metadata', 'auth-v1',
}

CORS_CONFIG_LINES = """\
        config:
          origins:
            - https://sbbl-hq.icu
            - https://www.sbbl-hq.icu
            - http://localhost:5173
          methods:
            - GET
            - HEAD
            - POST
            - PUT
            - PATCH
            - DELETE
            - OPTIONS
          headers:
            - Accept
            - Accept-Profile
            - Accept-Version
            - Authorization
            - Cache-Control
            - Content-Length
            - Content-MD5
            - Content-Profile
            - Content-Type
            - Date
            - If-Match
            - If-Modified-Since
            - If-None-Match
            - Prefer
            - Range
            - X-Requested-With
            - apikey
            - x-client-info
            - x-supabase-api-version
            - x-upsert
          exposed_headers:
            - Content-Length
            - Content-Range
            - X-Kong-Request-Id
          credentials: true
          max_age: 3600
          preflight_continue: false"""

REQUIRED_HEADERS = {
    'accept', 'accept-profile', 'accept-version', 'authorization',
    'cache-control', 'content-length', 'content-md5', 'content-profile',
    'content-type', 'date', 'if-match', 'if-modified-since', 'if-none-match',
    'prefer', 'range', 'x-requested-with', 'apikey', 'x-client-info',
    'x-supabase-api-version', 'x-upsert',
}


def discover_kong_path():
    result = subprocess.run(
        ['docker', 'inspect', 'supabase-kong', '--format',
         '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Cannot inspect supabase-kong:\n{result.stderr.strip()}")
    working_dir = result.stdout.strip()
    if not working_dir:
        raise RuntimeError("supabase-kong label 'project.working_dir' is empty")
    kong_path = os.path.join(working_dir, 'volumes', 'api', 'kong.yml')
    if not os.path.exists(kong_path):
        raise RuntimeError(f"Kong config not found at: {kong_path}")
    return working_dir, kong_path


def patch_auth_cors(text):
    """
    Insert the full CORS config block after every bare `- name: cors` line
    that belongs to an auth service.  Leaves already-configured and
    non-auth-service cors entries untouched.
    """
    lines = text.replace('\r\n', '\n').split('\n')
    out = []
    current_service = None

    for i, line in enumerate(lines):
        # Track top-level service names (exactly 2 leading spaces + "- name:")
        svc_m = re.match(r'^  - name: (\S+)', line)
        if svc_m:
            current_service = svc_m.group(1)

        # Bare cors line at 6-space indent inside an auth service
        if re.match(r'^      - name: cors\s*$', line) and current_service in AUTH_SERVICES:
            # Look ahead: is the next non-blank content line already "        config:"?
            j = i + 1
            while j < len(lines) and lines[j].strip() == '':
                j += 1
            if j < len(lines) and lines[j].startswith('        config:'):
                # Already has config — leave it alone
                out.append(line)
            else:
                # Add config immediately after this line
                out.append(line)
                out.extend(CORS_CONFIG_LINES.split('\n'))
        else:
            out.append(line)

    return '\n'.join(out)


def validate(text):
    """Return (ok: bool, report: list[str])."""
    report = []
    ok = True

    services = re.split(r'\n(?=  - name: )', text)
    for svc in services:
        m = re.match(r'\s*- name: (\S+)', svc)
        if not m or m.group(1) not in AUTH_SERVICES:
            continue
        name = m.group(1)
        if not re.search(r'      - name: cors\n        config:', svc):
            report.append(f"  FAIL {name}: bare cors (no config)")
            ok = False
            continue
        # Check all required headers present
        hblock = re.search(r'          headers:\n((?:            - [^\n]+\n)+)', svc)
        if not hblock:
            report.append(f"  FAIL {name}: headers block not found")
            ok = False
            continue
        found = {h.strip().lstrip('- ').lower() for h in hblock.group(1).splitlines()}
        missing = REQUIRED_HEADERS - found
        if missing:
            report.append(f"  FAIL {name}: missing headers {sorted(missing)}")
            ok = False
        else:
            report.append(f"  OK   {name}: 20 headers configured")

    return ok, report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would change without writing')
    args = parser.parse_args()

    print("=== DEFCON CORS PATCH V2 ===\n")

    try:
        working_dir, kong_path = discover_kong_path()
    except RuntimeError as e:
        print(f"BLOCKED: {e}")
        sys.exit(1)

    print(f"ActiveRoot : {working_dir}")
    print(f"KongPath   : {kong_path}\n")

    with open(kong_path, 'r', encoding='utf-8-sig') as f:
        original = f.read()

    # Check current state
    bare = len(re.findall(r'      - name: cors\s*\n(?!\s+config:)', original))
    configured = len(re.findall(r'      - name: cors\n        config:', original))
    print(f"State before: {configured} configured, {bare} bare cors plugins")

    ok_before, report_before = validate(original)
    if ok_before:
        print("ALREADY PATCHED — all auth routes have correct CORS config.")
        print("No file changes needed.  You can restart Kong safely.\n")
        for r in report_before:
            print(r)
        print(f"\nActiveRoot for restart:\n  {working_dir}")
        sys.exit(0)

    # Patch
    patched = patch_auth_cors(original)

    ok_after, report_after = validate(patched)
    print("\nState after patch:")
    for r in report_after:
        print(r)

    if not ok_after:
        print("\nBLOCKED: patch validation failed.  No file written.")
        # Diff summary
        orig_lines = original.split('\n')
        patch_lines = patched.split('\n')
        added = sum(1 for l in patch_lines if l not in orig_lines)
        print(f"Would have added ~{added} lines.")
        sys.exit(1)

    if args.dry_run:
        print("\nDRY RUN — no file written.")
        print(f"Would write {len(patched)} chars to {kong_path}")
        sys.exit(0)

    # Backup
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = f"{kong_path}.bak-cors-{stamp}"
    shutil.copy2(kong_path, backup)
    print(f"\nBackup     : {backup}")

    # Write (UTF-8, no BOM, LF line endings preserved)
    with open(kong_path, 'w', encoding='utf-8', newline='') as f:
        f.write(patched)
    print(f"Written    : {kong_path}")

    print("\nPATCH COMPLETE")
    print(f"\nNext step — restart Kong from the active Docker root:")
    print(f'  cd "{working_dir}"')
    print(f'  docker compose up -d --force-recreate kong')


if __name__ == '__main__':
    main()
