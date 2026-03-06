import logging
import pathlib
import subprocess

logger = logging.getLogger(__name__)


def sync_workspace(
    repo_url: str, workspace_dir: pathlib.Path, github_token: str | None = None
) -> None:
    if not repo_url:
        logger.info("No WORKSPACE_REPO_URL set, skipping git sync (using bind mount)")
        return

    if github_token and repo_url.startswith("https://"):
        repo_url = repo_url.replace("https://", f"https://x-access-token:{github_token}@")

    if (workspace_dir / ".git").exists():
        logger.info("Pulling workspace repo at %s", workspace_dir)
        result = subprocess.run(
            ["git", "-C", str(workspace_dir), "pull", "--ff-only"],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            logger.warning("git pull failed: %s", result.stderr)
    else:
        logger.info("Cloning workspace repo to %s", workspace_dir)
        workspace_dir.parent.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(
            ["git", "clone", repo_url, str(workspace_dir)],
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode != 0:
            logger.error("git clone failed: %s", result.stderr)
            raise RuntimeError(f"git clone failed: {result.stderr}")
