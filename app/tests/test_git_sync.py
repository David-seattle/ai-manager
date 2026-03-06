import pathlib
from unittest.mock import patch

from ai_manager.git_sync import sync_workspace


def test_sync_skips_when_repo_url_empty(tmp_path):
    """When repo_url is empty (bind-mount mode), git sync should be skipped entirely."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    with patch("ai_manager.git_sync.subprocess") as mock_subprocess:
        sync_workspace("", workspace)
        mock_subprocess.run.assert_not_called()


def test_sync_skips_when_repo_url_none(tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    with patch("ai_manager.git_sync.subprocess") as mock_subprocess:
        sync_workspace("", workspace, github_token="tok")
        mock_subprocess.run.assert_not_called()
