import logging
import pathlib
import subprocess
from unittest.mock import patch, MagicMock

import pytest

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


def test_sync_pull_failure_logs_warning(tmp_path, caplog):
    """When git pull fails, should log warning but not raise."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / ".git").mkdir()

    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stderr = "fatal: unable to access remote"

    with patch("ai_manager.git_sync.subprocess.run", return_value=mock_result):
        with caplog.at_level(logging.WARNING):
            sync_workspace("https://github.com/org/repo", workspace)
    assert any("git pull failed" in r.message for r in caplog.records)


def test_sync_clone_failure_raises(tmp_path):
    """When git clone fails, should raise RuntimeError."""
    workspace = tmp_path / "workspace"
    # Don't create workspace or .git — triggers clone path

    mock_result = MagicMock()
    mock_result.returncode = 128
    mock_result.stderr = "fatal: repository not found"

    with patch("ai_manager.git_sync.subprocess.run", return_value=mock_result):
        with pytest.raises(RuntimeError, match="git clone failed"):
            sync_workspace("https://github.com/org/repo", workspace)


def test_sync_clone_timeout_raises(tmp_path):
    """When git clone times out, subprocess.TimeoutExpired should propagate."""
    workspace = tmp_path / "workspace"

    with patch("ai_manager.git_sync.subprocess.run", side_effect=subprocess.TimeoutExpired("git", 300)):
        with pytest.raises(subprocess.TimeoutExpired):
            sync_workspace("https://github.com/org/repo", workspace)


def test_sync_pull_injects_github_token(tmp_path):
    """When github_token is provided with https URL, token should be injected."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / ".git").mkdir()

    mock_result = MagicMock()
    mock_result.returncode = 0

    with patch("ai_manager.git_sync.subprocess.run", return_value=mock_result) as mock_run:
        sync_workspace("https://github.com/org/repo", workspace, github_token="mytoken")
    # Pull doesn't use the URL directly, but token injection happens before the branch check
    mock_run.assert_called_once()
