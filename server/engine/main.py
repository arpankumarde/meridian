"""Main CLI entry point for the Meridian R&D intelligence engine."""

import asyncio
import signal
import subprocess
import sys
import webbrowser

import typer
from rich.console import Console
from rich.panel import Panel

from .agents.director import MeridianHarness
from .interaction import InputListener, InteractionConfig
from .logging_config import get_logger, setup_logging

setup_logging()
logger = get_logger(__name__)

console = Console()

app = typer.Typer(
    name="meridian",
    help="R&D intelligence platform with hierarchical multi-agent research.",
    add_completion=False,
)

# `meridian gdrive ...` sub-app for the Google Drive connector.
gdrive_app = typer.Typer(
    name="gdrive",
    help="Manage the Google Drive internal corpus connector.",
    add_completion=False,
)
app.add_typer(gdrive_app, name="gdrive")

_harness: MeridianHarness | None = None


def _handle_interrupt(signum, frame):
    console.print("\n[yellow]Interrupt received - stopping fact check...[/yellow]")
    harness = _harness
    if harness is not None:
        harness.stop()


@app.command()
def main(
    claim: str = typer.Argument(..., help="The claim or statement to fact-check"),
    iterations: int = typer.Option(1, "--iterations", "-n", help="Number of verification iterations (1 is usually enough)", min=1, max=10),
    db_path: str = typer.Option("meridian.db", "--db", "-d", help="Path to SQLite database"),
    no_clarify: bool = typer.Option(False, "--no-clarify", help="Skip pre-check clarification questions"),
    autonomous: bool = typer.Option(False, "--autonomous", "-a", help="Run fully autonomous"),
    timeout: int = typer.Option(60, "--timeout", help="Timeout for mid-check questions", min=10, max=300),
    depth: int = typer.Option(5, "--depth", help="Maximum verification depth", min=1, max=10),
):
    """Run an R&D intelligence audit on a research brief.

    Meridian decomposes the brief into sub-questions, gathers evidence from web,
    academic, patent, standards, regulatory, and internal sources, and produces a
    landscape report with confidence / consensus / source-diversity scores. No
    TRUE/FALSE verdicts — Meridian surfaces what is corroborated, what is contested,
    and what white space remains.

    Output is saved to: output/{slug}_{session-id}/
      - report.md         Narrative landscape report
      - evidence.json     Structured evidence data

    Examples:
        meridian "Perovskite tandem solar cell stability, last 24 months"
        meridian "Find prior art for solid-state lithium-metal anode disclosure"
        meridian "Is GLP-1 receptor agonist class effective for cardiovascular outcomes?"
    """
    global _harness

    console.print()
    console.print(Panel(
        "[bold]Meridian Fact Checker[/bold]\n"
        "Hierarchical multi-agent claim verification system",
        border_style="blue",
    ))

    signal.signal(signal.SIGINT, _handle_interrupt)
    signal.signal(signal.SIGTERM, _handle_interrupt)

    interaction_config = InteractionConfig.from_cli_args(
        no_clarify=no_clarify, autonomous=autonomous, timeout=timeout,
    )

    if autonomous:
        console.print("[dim]Running in autonomous mode[/dim]")
    elif no_clarify:
        console.print("[dim]Skipping clarification. Type + Enter during verification to inject guidance.[/dim]")
    else:
        console.print("[dim]Interactive mode. Type + Enter during verification to inject guidance.[/dim]")

    async def run():
        global _harness
        async with MeridianHarness(db_path, interaction_config=interaction_config, max_depth=depth) as harness:
            _harness = harness

            listener: InputListener | None = None
            if not interaction_config.autonomous_mode:
                listener = InputListener(
                    harness.director.interaction,
                    console=console,
                    on_interact_start=harness.director.pause_progress,
                    on_interact_end=harness.director.resume_progress,
                )
                harness.director.set_input_listener(listener)

            try:
                report = await harness.check(claim, iterations)
                return report
            except asyncio.CancelledError:
                console.print("[yellow]Fact check cancelled[/yellow]")
                return None
            finally:
                if listener:
                    listener.stop()

    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        console.print("\n[yellow]Exiting...[/yellow]")
        sys.exit(0)


@app.command()
def ui(
    session_id: str | None = typer.Argument(None, help="Optional session ID to open"),
    port: int = typer.Option(9090, "--port", "-p", help="API server port"),
    no_browser: bool = typer.Option(False, "--no-browser", help="Don't auto-open browser"),
    restart: bool = typer.Option(True, "--restart/--no-restart", help="Restart servers if ports in use"),
):
    """Launch the Meridian web UI."""
    import os
    import shutil
    import socket
    import time
    from pathlib import Path

    console.print()
    console.print(Panel(
        "[bold]Meridian UI[/bold]\nLaunching web interface...",
        border_style="blue",
    ))

    def check_port(port_num):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', port_num)) == 0
        sock.close()
        return result

    def kill_port(port_num):
        """Kill all processes listening on the given port."""
        try:
            result = subprocess.run(
                ["lsof", "-ti", f":{port_num}"],
                capture_output=True, text=True,
            )
            pids = result.stdout.strip().split()
            if pids:
                for pid in set(pids):
                    try:
                        os.kill(int(pid), signal.SIGTERM)
                    except (ProcessLookupError, ValueError):
                        pass
                # Wait for processes to die
                for _ in range(10):
                    if not check_port(port_num):
                        break
                    time.sleep(0.3)
                else:
                    # Force kill if still alive
                    for pid in set(pids):
                        try:
                            os.kill(int(pid), signal.SIGKILL)
                        except (ProcessLookupError, ValueError):
                            pass
                    time.sleep(0.5)
        except Exception:
            pass

    ui_port = 3004

    # Kill old servers so we always start fresh (picks up new .env, code changes, etc.)
    if check_port(port):
        console.print(f"[yellow]Killing old API server on port {port}...[/yellow]")
        kill_port(port)
    if check_port(ui_port):
        console.print(f"[yellow]Killing old frontend on port {ui_port}...[/yellow]")
        kill_port(ui_port)

    # Start API server
    console.print(f"[cyan]Starting API server on port {port}...[/cyan]")
    try:
        subprocess.Popen(
            [sys.executable, "-m", "api.server"],
            start_new_session=True,
            env=os.environ.copy(),
        )
        for i in range(10):
            if check_port(port):
                console.print("[green]API server started[/green]")
                break
            time.sleep(0.5)
        else:
            console.print("[red]Failed to start API server[/red]")
            sys.exit(1)
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)

    # Start Next.js frontend
    console.print(f"[cyan]Starting frontend on port {ui_port}...[/cyan]")
    # Repo root = two levels up from engine/main.py. We pin `cwd` so
    # `meridian ui` works from any directory, and drop `shell=True` so
    # the argv list is passed straight through to pnpm instead of being
    # mangled into `sh -c pnpm` (which silently drops the `dev` argument).
    repo_root = Path(__file__).resolve().parent.parent
    pnpm_bin = shutil.which("pnpm") or "pnpm"
    try:
        frontend_proc = subprocess.Popen(
            [pnpm_bin, "dev"],
            cwd=str(repo_root),
            start_new_session=True,
            env=os.environ.copy(),
        )
        # Give pnpm up to ~20s to start responding on the dev port.
        # Also bail early if the child exited — typically a missing
        # package.json or an uninstalled dependency.
        import urllib.request
        ready = False
        for i in range(20):
            if frontend_proc.poll() is not None:
                console.print(
                    f"[red]Frontend process exited early (code {frontend_proc.returncode}). "
                    "Run `pnpm install` in the repo root and try again.[/red]"
                )
                sys.exit(1)
            try:
                urllib.request.urlopen(f"http://localhost:{ui_port}", timeout=1)
                console.print("[green]Frontend started[/green]")
                ready = True
                break
            except Exception:
                time.sleep(1)
        if not ready:
            console.print(
                "[red]Failed to start frontend after 20s. "
                "Run `pnpm install` then `pnpm dev` manually to see the error.[/red]"
            )
            sys.exit(1)
    except FileNotFoundError:
        console.print(
            "[red]pnpm not found on PATH. Install pnpm (npm install -g pnpm) "
            "then rerun `meridian ui`.[/red]"
        )
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)

    url = f"http://localhost:{ui_port}"
    if session_id:
        url += f"/check/{session_id}"

    console.print(f"\n[bold green]All servers ready[/bold green]")
    console.print(f"[dim]Frontend: http://localhost:{ui_port}[/dim]")
    console.print(f"[dim]API: http://localhost:{port}[/dim]")

    if not no_browser:
        console.print(f"\n[cyan]Opening {url}...[/cyan]")
        webbrowser.open(url)

    console.print("\n[dim]Press Ctrl+C to stop[/dim]\n")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopping...[/yellow]")
        sys.exit(0)


# ----------------------------------------------------------------------------
# `meridian gdrive ...` subcommands
# ----------------------------------------------------------------------------


@gdrive_app.command("auth")
def gdrive_auth():
    """Run the one-time Google Drive OAuth flow.

    Opens your browser to the Google consent screen. After you approve,
    the resulting token is cached under ``~/.meridian/gdrive_token.json``.
    Requires an OAuth client ID JSON at ``~/.meridian/gdrive_client.json``
    (download it from Google Cloud Console → OAuth client ID → Desktop app).
    """
    from .ingest.gdrive import GDriveAuth

    console.print()
    console.print(
        Panel(
            "[bold]Google Drive OAuth[/bold]\n"
            "Authorizing Meridian to read your Drive (read-only scope).",
            border_style="blue",
        )
    )

    auth = GDriveAuth()
    if not auth.has_client_config():
        console.print(
            f"[red]Missing OAuth client config at {auth.client_config_path}.[/red]"
        )
        console.print(
            "Download an OAuth client ID (Desktop app) JSON from Google Cloud "
            "Console and save it to that path, then rerun this command."
        )
        sys.exit(1)

    try:
        auth.run_oauth_flow()
    except Exception as exc:
        console.print(f"[red]OAuth flow failed: {exc}[/red]")
        sys.exit(1)

    console.print(
        f"[green]Authorized.[/green] Token saved to {auth.token_path}"
    )
    console.print(
        "Next: run [bold]meridian gdrive sync[/bold] to index your Drive."
    )


@gdrive_app.command("sync")
def gdrive_sync(
    full: bool = typer.Option(
        False, "--full", help="Force a full sync (re-indexes everything).",
    ),
    max_files: int | None = typer.Option(
        None, "--max-files", help="Safety cap on files processed this run.",
    ),
):
    """Pull updates from Google Drive and index them into the internal corpus.

    First run is a full sync. Subsequent runs are incremental (delta against
    the persisted startPageToken). Use ``--full`` to force a fresh walk.
    """
    from .ingest.gdrive import GDriveAuth, GDriveIndexer, GDriveSync

    console.print()
    console.print(
        Panel(
            "[bold]Google Drive Sync[/bold]\n"
            "Indexing your internal corpus into the Meridian vector store.",
            border_style="blue",
        )
    )

    auth = GDriveAuth()
    if not auth.has_token():
        console.print(
            "[red]No Google Drive token. Run `meridian gdrive auth` first.[/red]"
        )
        sys.exit(1)

    indexer = GDriveIndexer()
    sync = GDriveSync(
        indexer=indexer,
        auth=auth,
        progress_callback=lambda msg: console.print(f"[dim]{msg}[/dim]"),
    )

    try:
        if full:
            state = sync.full_sync(max_files=max_files)
        else:
            state = sync.incremental_sync()
    except Exception as exc:
        console.print(f"[red]Sync failed: {exc}[/red]")
        sys.exit(1)

    console.print()
    console.print(
        f"[green]Done.[/green] Indexed {state.file_count} files total "
        f"(last sync: {state.last_full_sync_at or 'n/a'})"
    )


@gdrive_app.command("status")
def gdrive_status():
    """Show the current Google Drive connector status."""
    from .ingest.gdrive import GDriveAuth
    from .ingest.gdrive.sync import SYNC_STATE_PATH
    from .ingest.gdrive.models import SyncState

    auth = GDriveAuth()
    state = SyncState.load(SYNC_STATE_PATH)

    console.print()
    console.print(
        Panel(
            f"[bold]Google Drive Connector Status[/bold]\n\n"
            f"Authenticated: {'[green]yes[/green]' if auth.has_token() else '[red]no[/red]'}\n"
            f"Token path:    {auth.token_path}\n"
            f"Files indexed: {state.file_count}\n"
            f"Last sync:     {state.last_full_sync_at or 'never'}\n"
            f"Last error:    {state.last_error or 'none'}",
            border_style="blue",
        )
    )


def cli():
    app()


if __name__ == "__main__":
    cli()
