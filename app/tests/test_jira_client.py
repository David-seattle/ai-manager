import responses

from ai_manager.jira_client import JiraClient


@responses.activate
def test_fetch_issue_success():
    responses.add(
        responses.GET,
        "https://suplari.atlassian.net/rest/api/2/issue/EN-1234",
        json={
            "fields": {
                "summary": "Test issue",
                "description": "A test description",
                "status": {"name": "In Progress"},
                "assignee": {"emailAddress": "test@example.com"},
                "priority": {"name": "Medium"},
            }
        },
        status=200,
    )

    client = JiraClient("https://suplari.atlassian.net", "user@example.com", "token123")
    result = client.fetch_issue("EN-1234")

    assert result is not None
    assert result["summary"] == "Test issue"
    assert result["description"] == "A test description"
    assert result["status"] == "In Progress"
    assert result["assignee"] == "test@example.com"
    assert result["priority"] == "Medium"


@responses.activate
def test_fetch_issue_not_found():
    responses.add(
        responses.GET,
        "https://suplari.atlassian.net/rest/api/2/issue/EN-9999",
        json={"errorMessages": ["Issue does not exist"]},
        status=404,
    )

    client = JiraClient("https://suplari.atlassian.net", "user@example.com", "token123")
    result = client.fetch_issue("EN-9999")

    assert result is None


@responses.activate
def test_fetch_issue_network_error():
    responses.add(
        responses.GET,
        "https://suplari.atlassian.net/rest/api/2/issue/EN-5555",
        body=ConnectionError("Network error"),
    )

    client = JiraClient("https://suplari.atlassian.net", "user@example.com", "token123")
    result = client.fetch_issue("EN-5555")

    assert result is None
