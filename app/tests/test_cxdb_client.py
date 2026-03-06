import responses

from ai_manager.cxdb_client import CxdbClient


CXDB_URL = "http://localhost:9010"


@responses.activate
def test_create_context():
    responses.post(
        f"{CXDB_URL}/v1/contexts/create",
        json={"context_id": "42", "head_turn_id": "0", "head_depth": "0"},
    )
    client = CxdbClient(CXDB_URL)
    ctx = client.create_context(tag="aim-abc1")
    assert ctx.context_id == 42
    assert ctx.head_turn_id == 0
    body = responses.calls[0].request.body
    assert b'"tag"' in body
    assert b'"aim-abc1"' in body


@responses.activate
def test_append_turn():
    responses.post(
        f"{CXDB_URL}/v1/contexts/42/append",
        json={"new_turn_id": "1"},
    )
    client = CxdbClient(CXDB_URL)
    turn_id = client.append_turn(42, "ai_manager.session_metadata", {"session_id": "s1"})
    assert turn_id == 1


@responses.activate
def test_list_contexts_by_tag():
    responses.get(
        f"{CXDB_URL}/v1/contexts",
        json={"contexts": [
            {"context_id": "42", "head_turn_id": "3", "head_depth": "3"},
        ]},
    )
    client = CxdbClient(CXDB_URL)
    ctxs = client.list_contexts(tag="aim-abc1")
    assert len(ctxs) == 1
    assert ctxs[0].context_id == 42
    assert "tag=aim-abc1" in responses.calls[0].request.url


@responses.activate
def test_get_turns():
    responses.get(
        f"{CXDB_URL}/v1/contexts/42/turns",
        json={"turns": [
            {
                "turn_id": "1",
                "parent_turn_id": "0",
                "depth": "1",
                "type_id": "ai_manager.session_metadata",
                "type_version": "1",
                "data": {"session_id": "s1"},
            },
        ]},
    )
    client = CxdbClient(CXDB_URL)
    turns = client.get_turns(42)
    assert len(turns) == 1
    assert turns[0].type_id == "ai_manager.session_metadata"
    assert turns[0].data["session_id"] == "s1"


@responses.activate
def test_healthy_true():
    responses.get(f"{CXDB_URL}/v1/contexts", json={"contexts": []})
    client = CxdbClient(CXDB_URL)
    assert client.healthy()


@responses.activate
def test_healthy_false():
    responses.get(f"{CXDB_URL}/v1/contexts", body=responses.ConnectionError())
    client = CxdbClient(CXDB_URL)
    assert not client.healthy()
