"""End-to-end API tests against an in-memory SQLite database. Run: `pytest` (from server/)."""
import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256-signing"
os.environ["ALLOW_UNVERIFIED_PASSWORD_RESET"] = "true"

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

from app.db import get_engine
from app.main import app

PROFILE = {
    "name": "Renu",
    "course": "B.Tech CSE",
    "year": "3rd year",
    "skills": [
        {"skill": "Python", "category": "programming", "level": 3, "selfLevel": 1, "quiz": {"correct": 3, "total": 3, "level": 3, "takenAt": "2026-10-27T10:00:00Z"}},
        {"skill": "HTML / CSS", "category": "web", "level": 2, "selfLevel": 2},
    ],
    "priorProjects": "one",
    "weeklyHours": 6,
    # The client's own score must be ignored by the server.
    "assessment": {"score": 100, "level": "advanced"},
}
IDEA = {"title": "Smart Campus Companion", "description": "An app that helps students find free classrooms and track attendance.", "domain": "web", "durationWeeks": 8}


@pytest.fixture()
def client():
    SQLModel.metadata.drop_all(get_engine())
    with TestClient(app) as c:  # runs the lifespan, which creates the tables
        yield c


def register(client, email="renu@college.edu", password="secret123"):
    r = client.post("/auth/register", json={"name": "Renu", "email": email, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_register_login_logout(client):
    r = client.post("/auth/register", json={"name": "Renu", "email": " Renu@College.edu ", "password": "secret123"})
    body = r.json()
    assert r.status_code == 201
    assert body["user"]["email"] == "renu@college.edu" and body["user"]["createdAt"].endswith("Z")
    assert "passwordHash" not in body["user"] and "password_hash" not in body["user"]

    assert client.post("/auth/register", json={"name": "Renu", "email": "renu@college.edu", "password": "secret123"}).status_code == 409
    wrong = client.post("/auth/login", json={"email": "renu@college.edu", "password": "nope12345"})
    unknown = client.post("/auth/login", json={"email": "nobody@college.edu", "password": "secret123"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["message"] == unknown.json()["message"] == "Email or password is incorrect."

    token = client.post("/auth/login", json={"email": "RENU@college.edu", "password": "secret123"}).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.post("/auth/logout", headers=headers).status_code == 204
    # The token stops working after sign out.
    assert client.get("/students/me", headers=headers).status_code == 401


def test_weak_password_rejected(client):
    r = client.post("/auth/register", json={"name": "Renu", "email": "renu@college.edu", "password": "onlyletters"})
    assert r.status_code == 422 and "letter and one number" in r.json()["message"]


def test_broken_json_gets_a_clear_message(client):
    h = register(client)
    r = client.post("/projects", content='{"title": ""Smart"}', headers={**h, "Content-Type": "application/json"})
    assert r.status_code == 422 and "isn't valid JSON" in r.json()["message"]


def test_requires_sign_in(client):
    assert client.get("/students/me").status_code == 401
    assert client.get("/students/me", headers={"Authorization": "Bearer not-a-token"}).status_code == 401


def test_profile_assessment_is_computed_on_server(client):
    h = register(client)
    assert client.get("/students/me", headers=h).status_code == 404
    r = client.post("/students", json=PROFILE, headers=h)
    assert r.status_code == 200, r.text
    profile = r.json()
    # skills 3+2=5 → round(5/12*60)=25, one project 12, 6h → 6: total 43
    assert profile["assessment"]["score"] == 43
    assert profile["assessment"]["level"] == "intermediate"
    assert profile["assessment"]["verifiedShare"] == 0.5
    assert profile["skills"][0]["quiz"]["level"] == 3
    assert client.get("/students/me", headers=h).json()["id"] == profile["id"]

    updated = client.put(f"/students/{profile['id']}", json={**PROFILE, "weeklyHours": 15}, headers=h).json()
    assert updated["assessment"]["score"] == 52 and updated["id"] == profile["id"]


def test_quiz_score_cannot_exceed_total(client):
    h = register(client)
    bad = {**PROFILE, "skills": [{**PROFILE["skills"][0], "quiz": {"correct": 10, "total": 1, "level": 1, "takenAt": "x"}}]}
    r = client.post("/students", json=bad, headers=h)
    assert r.status_code == 422 and "can't be more than" in r.json()["message"]


def test_idea_trigger_and_delete(client):
    h = register(client)
    student = client.post("/students", json=PROFILE, headers=h).json()

    r = client.post("/projects", json={**IDEA, "studentId": student["id"]}, headers=h)
    assert r.status_code == 201, r.text
    project = r.json()
    assert project["customDomain"] is None and project["latestRunId"] is None

    run = client.post(f"/projects/{project['id']}/pipeline-runs", headers=h).json()
    assert run["status"] == "queued"
    assert [s["agentId"] for s in run["steps"]] == ["feasibility", "scope_tech", "planner", "risk"]
    assert all(s["status"] == "queued" for s in run["steps"])
    assert client.get(f"/projects/{project['id']}", headers=h).json()["latestRunId"] == run["id"]
    assert client.get(f"/pipeline-runs/{run['id']}", headers=h).json()["id"] == run["id"]
    assert len(client.get(f"/students/{student['id']}/projects", headers=h).json()) == 1

    assert client.delete(f"/projects/{project['id']}", headers=h).status_code == 204
    assert client.get(f"/projects/{project['id']}", headers=h).status_code == 404
    assert client.get(f"/pipeline-runs/{run['id']}", headers=h).status_code == 404


def test_custom_project_type(client):
    h = register(client)
    student = client.post("/students", json=PROFILE, headers=h).json()
    missing = client.post("/projects", json={**IDEA, "domain": "other", "studentId": student["id"]}, headers=h)
    assert missing.status_code == 422
    ok = client.post("/projects", json={**IDEA, "domain": "other", "customDomain": " Cybersecurity ", "studentId": student["id"]}, headers=h)
    assert ok.json()["customDomain"] == "Cybersecurity"


def test_students_cannot_see_each_others_data(client):
    renu = register(client, "renu@college.edu")
    ashok = register(client, "ashok@college.edu")
    student = client.post("/students", json=PROFILE, headers=renu).json()
    project = client.post("/projects", json={**IDEA, "studentId": student["id"]}, headers=renu).json()
    run = client.post(f"/projects/{project['id']}/pipeline-runs", headers=renu).json()

    assert client.get(f"/projects/{project['id']}", headers=ashok).status_code == 404
    assert client.delete(f"/projects/{project['id']}", headers=ashok).status_code == 404
    assert client.get(f"/pipeline-runs/{run['id']}", headers=ashok).status_code == 404
    assert client.get(f"/students/{student['id']}/projects", headers=ashok).status_code == 404
    assert client.put(f"/students/{student['id']}", json=PROFILE, headers=ashok).status_code == 404
    assert client.post("/projects", json={**IDEA, "studentId": student["id"]}, headers=ashok).status_code == 404


def test_reset_password_ends_old_sessions(client):
    old = register(client)
    assert client.post("/auth/reset-password", json={"email": "nobody@college.edu", "password": "newpass123"}).status_code == 404
    assert client.post("/auth/reset-password", json={"email": "renu@college.edu", "password": "newpass123"}).status_code == 204
    assert client.get("/students/me", headers=old).status_code == 401
    assert client.post("/auth/login", json={"email": "renu@college.edu", "password": "secret123"}).status_code == 401
    assert client.post("/auth/login", json={"email": "renu@college.edu", "password": "newpass123"}).status_code == 200
