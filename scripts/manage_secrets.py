#!/usr/bin/env python3
"""
Raven production secret helper.

This script automates safe parts of secret registration and verification.
Interactive logins/authorizations still happen in the browser or dashboard.

It never prints secret values.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "dist" / "server" / "wrangler.json"
SOURCE_CONFIG = ROOT / "wrangler.toml"
DEFAULT_SERVICE_ACCOUNT = Path.home() / "Downloads" / "raven-502815-2e1466ba2a60.json"

EXPECTED_ACCOUNT_ID = "c7ce2613bf30affed8d2caae0068beb5"
EXPECTED_ZONE_ID = "65356f2d324639213440b57fbd06d1e2"
EXPECTED_GA4_PROPERTY_ID = "546077100"
EXPECTED_SEARCH_CONSOLE_SITE_URL = "https://raven.fortunestudios.jp/"
EXPECTED_GOOGLE_SERVICE_ACCOUNT_EMAIL = "fortune-studio-analytics@raven-502815.iam.gserviceaccount.com"
EXPECTED_GOOGLE_PROJECT_ID = "raven-502815"
ORIGIN = "https://raven.fortunestudios.jp"
GRAPH_VERSION = "v26.0"


class SecretError(RuntimeError):
    pass


def wrangler_bin() -> str:
    local = ROOT / "node_modules" / ".bin" / ("wrangler.cmd" if os.name == "nt" else "wrangler")
    return str(local) if local.exists() else "wrangler"


def config_path() -> Path:
    return DEFAULT_CONFIG if DEFAULT_CONFIG.exists() else SOURCE_CONFIG


def run(
    args: list[str],
    *,
    input_text: str | None = None,
    check: bool = True,
    clean_cloudflare_env: bool = False,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    if clean_cloudflare_env:
        env.pop("CLOUDFLARE_API_TOKEN", None)
    proc = subprocess.run(
        args,
        cwd=ROOT,
        env=env,
        input=input_text,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        shell=False,
    )
    if check and proc.returncode != 0:
        raise SecretError((proc.stderr or proc.stdout or f"Command failed: {' '.join(args)}").strip())
    return proc


def put_secret(name: str, value: str) -> None:
    if not value:
        raise SecretError(f"{name} is empty")
    args = [wrangler_bin(), "secret", "put", name, "--config", str(config_path())]
    run(args, input_text=value + "\n", clean_cloudflare_env=True)
    print(f"OK secret uploaded: {name}")


def secret_names() -> list[str]:
    proc = run([wrangler_bin(), "secret", "list", "--config", str(config_path())])
    try:
        return [item["name"] for item in json.loads(proc.stdout)]
    except Exception as exc:
        raise SecretError(f"Could not parse wrangler secret list: {exc}") from exc


def read_google_key(path: Path) -> dict:
    if not path.exists():
        raise SecretError(f"Google service account JSON not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not data.get("private_key") or not data.get("client_email"):
        raise SecretError("Google service account JSON is missing private_key or client_email")
    return data


def is_expected_google_key(path: Path) -> bool:
    try:
        data = read_google_key(path)
    except Exception:
        return False
    return (
        data.get("client_email") == EXPECTED_GOOGLE_SERVICE_ACCOUNT_EMAIL
        and data.get("project_id") == EXPECTED_GOOGLE_PROJECT_ID
    )


def find_google_key() -> Path:
    candidates = [
        DEFAULT_SERVICE_ACCOUNT,
        *sorted((Path.home() / "Downloads").glob("raven-502815-*.json")),
        *sorted((Path.home() / "Documents").glob("**/raven-502815-*.json")),
        *sorted((Path.home() / "OneDrive" / "Documents").glob("**/raven-502815-*.json")),
    ]
    for path in candidates:
        if not path.exists() or not path.is_file():
            continue
        if is_expected_google_key(path):
            return path
    raise SecretError(
        "Google service account key was not found automatically. "
        "Download a JSON key for fortune-studio-analytics and rerun bootstrap."
    )


def wrangler_oauth_token() -> str:
    candidates = [
        Path(os.environ.get("APPDATA", "")) / "xdg.config" / ".wrangler" / "config" / "default.toml",
        Path.home() / ".wrangler" / "config" / "default.toml",
    ]
    for path in candidates:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        marker = 'oauth_token = "'
        start = text.find(marker)
        if start == -1:
            continue
        start += len(marker)
        end = text.find('"', start)
        if end > start:
            return text[start:end]
    raise SecretError("Wrangler OAuth token not found. Run `wrangler login` first.")


def whoami() -> None:
    proc = run([wrangler_bin(), "whoami"])
    output = proc.stdout
    print(output.strip())
    if EXPECTED_ACCOUNT_ID not in output:
        raise SecretError(f"Active Cloudflare account does not include expected account id: {EXPECTED_ACCOUNT_ID}")


def register_core(args: argparse.Namespace) -> None:
    google_key_path = find_google_key() if args.auto_google_key else Path(args.google_key)
    print(f"OK Google key detected: {google_key_path}")
    google_key = read_google_key(google_key_path)
    if google_key["client_email"] != EXPECTED_GOOGLE_SERVICE_ACCOUNT_EMAIL:
        raise SecretError(
            "Google service account email mismatch: "
            f"{google_key['client_email']} != {EXPECTED_GOOGLE_SERVICE_ACCOUNT_EMAIL}"
        )

    put_secret("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", google_key["private_key"])

    cloudflare_token = args.cloudflare_token or os.environ.get("CLOUDFLARE_API_TOKEN")
    if args.use_wrangler_oauth_token:
        print("WARN --use-wrangler-oauth-token is for recovery only. Prefer a scoped Cloudflare API Token.")
        cloudflare_token = wrangler_oauth_token()
    if cloudflare_token:
        validate_cloudflare_token_value(cloudflare_token)
        put_secret("CLOUDFLARE_API_TOKEN", cloudflare_token)
    else:
        print("SKIP CLOUDFLARE_API_TOKEN: pass --cloudflare-token, set env var, or use --use-wrangler-oauth-token")

    put_secret("CLOUDFLARE_ZONE_ID", args.cloudflare_zone_id)


def cloudflare_api_json(path: str, token: str, *, method: str = "GET", body: dict | None = None) -> dict:
    data = None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "RavenSecretManager/1.0 (+https://raven.fortunestudios.jp/)",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(f"https://api.cloudflare.com/client/v4{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise SecretError(f"Cloudflare API error {exc.code}: {raw}") from exc


def validate_cloudflare_token_value(token: str) -> None:
    verify = cloudflare_api_json("/user/tokens/verify", token)
    if not verify.get("success"):
        raise SecretError(f"Cloudflare token verify failed: {verify}")

    end = time.strftime("%Y-%m-%d", time.gmtime())
    start = time.strftime("%Y-%m-%d", time.gmtime(time.time() - 7 * 24 * 60 * 60))
    query = """
      query ZoneAnalytics($zoneTag: string, $start: Date, $end: Date) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1dGroups(limit: 1, filter: { date_geq: $start, date_lt: $end }) {
              sum { requests pageViews bytes threats }
            }
          }
        }
      }
    """
    graph = cloudflare_api_json(
        "/graphql",
        token,
        method="POST",
        body={"query": query, "variables": {"zoneTag": EXPECTED_ZONE_ID, "start": start, "end": end}},
    )
    if graph.get("errors"):
        raise SecretError(f"Cloudflare GraphQL Analytics permission check failed: {graph['errors'][0].get('message')}")
    zones = graph.get("data", {}).get("viewer", {}).get("zones", [])
    if not zones:
        raise SecretError("Cloudflare token cannot access the expected zone analytics.")
    print("OK Cloudflare API token verified for GraphQL Analytics")


def register_cloudflare_token(args: argparse.Namespace) -> None:
    token = args.cloudflare_token or os.environ.get("CLOUDFLARE_API_TOKEN")
    if not token:
        raise SecretError("Cloudflare API token missing. Set CLOUDFLARE_API_TOKEN or pass --cloudflare-token.")
    validate_cloudflare_token_value(token)
    put_secret("CLOUDFLARE_API_TOKEN", token)
    put_secret("CLOUDFLARE_ZONE_ID", EXPECTED_ZONE_ID)


def diagnose_cloudflare_token(args: argparse.Namespace) -> None:
    token = args.cloudflare_token or os.environ.get("CLOUDFLARE_API_TOKEN")
    if not token:
        raise SecretError("Cloudflare API token missing. Set CLOUDFLARE_API_TOKEN or pass --cloudflare-token.")
    verify = cloudflare_api_json("/user/tokens/verify", token)
    result = verify.get("result", {})
    token_id = result.get("id", "")
    print(f"OK token verifies: {bool(verify.get('success'))}")
    print(f"Token id: {token_id[:8]}...{token_id[-8:] if token_id else ''}")
    for label, path in [
        ("zone details", f"/zones/{EXPECTED_ZONE_ID}"),
        ("zone analytics dashboard", f"/zones/{EXPECTED_ZONE_ID}/analytics/dashboard?since=-60&until=0"),
    ]:
        try:
            payload = cloudflare_api_json(path, token)
            print(f"OK {label}: {bool(payload.get('success'))}")
        except SecretError as exc:
            print(f"FAIL {label}: {exc}")
    try:
        validate_cloudflare_token_value(token)
    except SecretError as exc:
        print(f"FAIL graphql analytics: {exc}")
    else:
        print("OK graphql analytics")


def cloudflare_oauth_api_probe() -> None:
    token = wrangler_oauth_token()
    try:
        payload = cloudflare_api_json("/user/tokens/permission_groups?name=Account%20Analytics", token)
    except SecretError as exc:
        raise SecretError(f"Wrangler OAuth cannot list token permission groups: {exc}") from exc
    groups = payload.get("result", [])
    if not payload.get("success") or not groups:
        raise SecretError("Wrangler OAuth did not return Account Analytics permission group.")
    print("OK Wrangler OAuth can read Cloudflare token permission groups")


def cloudflare_oauth_zone_probe() -> None:
    token = wrangler_oauth_token()
    zone = cloudflare_api_json(f"/zones/{EXPECTED_ZONE_ID}", token)
    print(f"OK Wrangler OAuth can read zone: {zone.get('result', {}).get('name')}")


def register_instagram(args: argparse.Namespace) -> None:
    token = args.instagram_access_token or os.environ.get("INSTAGRAM_ACCESS_TOKEN")
    account_id = args.instagram_account_id or os.environ.get("INSTAGRAM_ACCOUNT_ID")
    if not token or not account_id:
        raise SecretError("Instagram token/account id missing. Pass --instagram-access-token and --instagram-account-id.")
    put_secret("INSTAGRAM_ACCESS_TOKEN", token)
    put_secret("INSTAGRAM_ACCOUNT_ID", account_id)


def graph_json(path: str, token: str, params: dict | None = None) -> dict:
    query = dict(params or {})
    query["access_token"] = token
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{path.lstrip('/')}?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "RavenSecretManager/1.0 (+https://raven.fortunestudios.jp/)",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise SecretError(f"Meta Graph API error {exc.code}: {raw}") from exc


def graph_public_json(path: str, params: dict) -> dict:
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{path.lstrip('/')}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "RavenSecretManager/1.0 (+https://raven.fortunestudios.jp/)",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise SecretError(f"Meta Graph API error {exc.code}: {raw}") from exc


def exchange_long_lived_meta_user_token(args: argparse.Namespace) -> str:
    app_id = args.meta_app_id or os.environ.get("META_APP_ID")
    app_secret = args.meta_app_secret or os.environ.get("META_APP_SECRET")
    short_token = args.meta_user_token or os.environ.get("META_USER_ACCESS_TOKEN")
    if not app_id or not app_secret or not short_token:
        raise SecretError("META_APP_ID, META_APP_SECRET, and META_USER_ACCESS_TOKEN are required.")

    payload = graph_public_json(
        "oauth/access_token",
        {
            "grant_type": "fb_exchange_token",
            "client_id": app_id,
            "client_secret": app_secret,
            "fb_exchange_token": short_token,
        },
    )
    token = payload.get("access_token")
    if not token:
        raise SecretError(f"Long-lived token exchange did not return access_token: {payload}")
    expires_in = int(payload.get("expires_in") or 0)
    if expires_in:
        expires_at = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(time.time() + expires_in))
        print(f"OK long-lived Meta user token created. Expires at approx: {expires_at}")
    else:
        print("OK long-lived Meta user token created. Expiration was not returned.")
    return token


def register_instagram_from_user_token(args: argparse.Namespace) -> None:
    token = args.meta_user_token or os.environ.get("META_USER_ACCESS_TOKEN")
    if not token:
        raise SecretError("Meta user token missing. Set META_USER_ACCESS_TOKEN or pass --meta-user-token.")

    profile = graph_json("me", token, {"fields": "id,name"})
    print(f"OK Meta user token valid: {profile.get('name', profile.get('id', 'unknown'))}")

    accounts = graph_json(
        "me/accounts",
        token,
        {"fields": "name,access_token,tasks,instagram_business_account"},
    ).get("data", [])
    if not accounts:
        raise SecretError(
            "No Facebook Pages were returned. Regenerate the token after granting page access "
            "with pages_show_list, pages_read_engagement, instagram_basic, instagram_content_publish."
        )

    selected = None
    for account in accounts:
        page_name_ok = not args.page_name or args.page_name.lower() in account.get("name", "").lower()
        has_instagram = bool(account.get("instagram_business_account", {}).get("id"))
        if page_name_ok and has_instagram and account.get("access_token"):
            selected = account
            break
    if selected is None:
        page_names = ", ".join(account.get("name", "(unnamed)") for account in accounts)
        raise SecretError(f"No Page with linked Instagram Business account found. Returned Pages: {page_names}")

    page_token = selected["access_token"]
    ig_id = selected["instagram_business_account"]["id"]
    ig = graph_json(ig_id, page_token, {"fields": "id,username,name"})
    print(f"OK Instagram account detected: {ig.get('username') or ig.get('name') or ig_id}")
    print(f"OK Facebook Page detected: {selected.get('name')}")

    put_secret("INSTAGRAM_ACCESS_TOKEN", page_token)
    put_secret("INSTAGRAM_ACCOUNT_ID", ig_id)


def register_instagram_long_lived(args: argparse.Namespace) -> None:
    long_user_token = exchange_long_lived_meta_user_token(args)
    register_args = argparse.Namespace(
        meta_user_token=long_user_token,
        page_name=args.page_name,
    )
    register_instagram_from_user_token(register_args)


def google_console_urls() -> dict[str, str]:
    encoded_email = urllib.parse.quote(EXPECTED_GOOGLE_SERVICE_ACCOUNT_EMAIL, safe="")
    return {
        "service_account_keys": (
            "https://console.cloud.google.com/iam-admin/serviceaccounts/details/"
            f"{encoded_email}/keys?project={EXPECTED_GOOGLE_PROJECT_ID}"
        ),
        "search_console_users": "https://search.google.com/search-console/users?resource_id=sc-domain%3Afortunestudios.jp",
        "ga4_admin": f"https://analytics.google.com/analytics/web/#/a/p{EXPECTED_GA4_PROPERTY_ID}/admin",
    }


def open_google_console(args: argparse.Namespace) -> None:
    urls = google_console_urls()
    if args.target == "all":
        targets = ["service_account_keys", "search_console_users", "ga4_admin"]
    else:
        targets = [args.target]
    for target in targets:
        print(f"OPEN {target}: {urls[target]}")
        webbrowser.open(urls[target])


def watch_google_key(args: argparse.Namespace) -> Path:
    downloads = Path(args.downloads)
    before = {path.resolve() for path in downloads.glob("*.json")}
    deadline = time.time() + args.timeout
    print(f"WAIT Google service account JSON download: {downloads} ({args.timeout}s)")
    while time.time() < deadline:
        candidates = sorted(downloads.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        for path in candidates:
            if path.resolve() in before and not args.include_existing:
                continue
            if is_expected_google_key(path):
                print(f"OK Google key detected: {path}")
                return path
        time.sleep(2)
    raise SecretError(
        "Google key JSON was not detected. In Google Cloud Console, create/download a JSON key for "
        f"{EXPECTED_GOOGLE_SERVICE_ACCOUNT_EMAIL}, then rerun google-register-latest-key."
    )


def google_register_latest_key(args: argparse.Namespace) -> None:
    path = watch_google_key(args)
    data = read_google_key(path)
    put_secret("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", data["private_key"])


def google_browser_bootstrap(args: argparse.Namespace) -> None:
    open_google_console(argparse.Namespace(target="service_account_keys"))
    google_register_latest_key(args)


def register_instagram_if_available() -> None:
    token = os.environ.get("INSTAGRAM_ACCESS_TOKEN")
    account_id = os.environ.get("INSTAGRAM_ACCOUNT_ID")
    if not token or not account_id:
        print("SKIP Instagram secrets: INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_ACCOUNT_ID are not in environment")
        return
    put_secret("INSTAGRAM_ACCESS_TOKEN", token)
    put_secret("INSTAGRAM_ACCOUNT_ID", account_id)


def check_secrets() -> None:
    names = set(secret_names())
    required = {
        "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_ZONE_ID",
    }
    optional = {"INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_ACCOUNT_ID"}
    for name in sorted(required):
        print(("OK" if name in names else "MISSING") + f" required secret: {name}")
    for name in sorted(optional):
        print(("OK" if name in names else "MISSING") + f" optional secret: {name}")
    missing = required - names
    if missing:
        raise SecretError(f"Missing required secrets: {', '.join(sorted(missing))}")


def http_json(path: str, *, method: str = "GET", body: dict | None = None) -> dict:
    data = None
    headers = {
        "Accept": "application/json",
        "User-Agent": "RavenSecretManager/1.0 (+https://raven.fortunestudios.jp/)",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(f"{ORIGIN}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read().decode("utf-8")
    return json.loads(raw) if raw else {}


def sync_external(args: argparse.Namespace) -> None:
    payload = http_json("/api/growth-engine/external-sync", method="POST", body={"tenantId": "raven-oracle", "days": args.days})
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    failed = [item for item in payload.get("results", []) if not item.get("ok")]
    if failed:
        print("WARN failed connectors:")
        for item in failed:
            print(f"- {item.get('source')}: {item.get('error')}")


def summary(args: argparse.Namespace) -> None:
    payload = http_json(f"/api/analytics/summary?days={args.days}")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def preflight() -> None:
    run(["npm.cmd" if os.name == "nt" else "npm", "run", "preflight:prod"])


def bootstrap(args: argparse.Namespace) -> None:
    whoami()
    core_args = argparse.Namespace(
        google_key=args.google_key,
        auto_google_key=True,
        cloudflare_token="",
        use_wrangler_oauth_token=True,
        cloudflare_zone_id=EXPECTED_ZONE_ID,
    )
    register_core(core_args)
    if args.include_instagram:
        register_instagram_if_available()
    check_secrets()
    sync_external(argparse.Namespace(days=args.days))
    preflight()


def main() -> int:
    parser = argparse.ArgumentParser(description="Register and verify Raven production secrets.")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("whoami")
    sub.add_parser("list")
    sub.add_parser("check")
    sub.add_parser("preflight")
    sub.add_parser("cloudflare-oauth-probe")
    sub.add_parser("cloudflare-oauth-zone-probe")

    core = sub.add_parser("register-core")
    core.add_argument("--google-key", default=str(DEFAULT_SERVICE_ACCOUNT))
    core.add_argument("--auto-google-key", action="store_true")
    core.add_argument("--cloudflare-token", default="")
    core.add_argument("--use-wrangler-oauth-token", action="store_true")
    core.add_argument("--cloudflare-zone-id", default=EXPECTED_ZONE_ID)

    cf = sub.add_parser("register-cloudflare-token")
    cf.add_argument("--cloudflare-token", default="")

    cf_diag = sub.add_parser("diagnose-cloudflare-token")
    cf_diag.add_argument("--cloudflare-token", default="")

    insta = sub.add_parser("register-instagram")
    insta.add_argument("--instagram-access-token", default="")
    insta.add_argument("--instagram-account-id", default="")

    meta = sub.add_parser("register-instagram-from-meta")
    meta.add_argument("--meta-user-token", default="")
    meta.add_argument("--page-name", default="")

    meta_long = sub.add_parser("register-instagram-long-lived")
    meta_long.add_argument("--meta-app-id", default="")
    meta_long.add_argument("--meta-app-secret", default="")
    meta_long.add_argument("--meta-user-token", default="")
    meta_long.add_argument("--page-name", default="")

    google_open = sub.add_parser("google-open-console")
    google_open.add_argument(
        "--target",
        choices=["all", "service_account_keys", "search_console_users", "ga4_admin"],
        default="all",
    )

    google_watch = sub.add_parser("google-register-latest-key")
    google_watch.add_argument("--downloads", default=str(Path.home() / "Downloads"))
    google_watch.add_argument("--timeout", type=int, default=180)
    google_watch.add_argument("--include-existing", action="store_true")

    google_boot = sub.add_parser("google-browser-bootstrap")
    google_boot.add_argument("--downloads", default=str(Path.home() / "Downloads"))
    google_boot.add_argument("--timeout", type=int, default=300)
    google_boot.add_argument("--include-existing", action="store_true")

    sync = sub.add_parser("sync-external")
    sync.add_argument("--days", type=int, default=30)

    summ = sub.add_parser("summary")
    summ.add_argument("--days", type=int, default=30)

    boot = sub.add_parser("bootstrap")
    boot.add_argument("--google-key", default=str(DEFAULT_SERVICE_ACCOUNT))
    boot.add_argument("--days", type=int, default=30)
    boot.add_argument("--include-instagram", action="store_true")

    args = parser.parse_args()
    try:
        if args.command == "whoami":
            whoami()
        elif args.command == "list":
            print(json.dumps(secret_names(), ensure_ascii=False, indent=2))
        elif args.command == "check":
            check_secrets()
        elif args.command == "register-core":
            register_core(args)
        elif args.command == "register-cloudflare-token":
            register_cloudflare_token(args)
        elif args.command == "diagnose-cloudflare-token":
            diagnose_cloudflare_token(args)
        elif args.command == "register-instagram":
            register_instagram(args)
        elif args.command == "register-instagram-from-meta":
            register_instagram_from_user_token(args)
        elif args.command == "register-instagram-long-lived":
            register_instagram_long_lived(args)
        elif args.command == "google-open-console":
            open_google_console(args)
        elif args.command == "google-register-latest-key":
            google_register_latest_key(args)
        elif args.command == "google-browser-bootstrap":
            google_browser_bootstrap(args)
        elif args.command == "sync-external":
            sync_external(args)
        elif args.command == "summary":
            summary(args)
        elif args.command == "preflight":
            preflight()
        elif args.command == "cloudflare-oauth-probe":
            cloudflare_oauth_api_probe()
        elif args.command == "cloudflare-oauth-zone-probe":
            cloudflare_oauth_zone_probe()
        elif args.command == "bootstrap":
            bootstrap(args)
    except SecretError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
