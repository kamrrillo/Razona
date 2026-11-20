from pathlib import Path

from razona_agent.config import (
    DEFAULT_MODEL,
    MissingCredentialsError,
    load_settings,
    require_model_credentials,
)


def _write(path: Path, text: str) -> Path:
    path.write_text(text)
    return path


def test_default_model_is_adk_default():
    from google.adk.agents import LlmAgent

    assert DEFAULT_MODEL == LlmAgent.DEFAULT_MODEL
    assert load_settings({}, None, None).model == DEFAULT_MODEL


def test_repo_env_local_fallback_for_supabase(tmp_path):
    repo_env = _write(
        tmp_path / ".env.local",
        "NEXT_PUBLIC_SUPABASE_URL=http://x:1\nSUPABASE_SECRET_KEY=secret\nGEMINI_MODEL=ignored\n",
    )
    s = load_settings({}, None, repo_env)
    assert s.supabase_url == "http://x:1"
    assert s.supabase_secret_key == "secret"
    assert s.model == DEFAULT_MODEL  # model is NOT taken from the Next.js env


def test_package_env_overrides_repo_env_and_process_env_wins(tmp_path):
    pkg = _write(tmp_path / ".env", "SUPABASE_URL=http://pkg\nGEMINI_MODEL=gemini-x\n")
    repo_env = _write(tmp_path / ".env.local", "NEXT_PUBLIC_SUPABASE_URL=http://repo\n")
    assert load_settings({}, pkg, repo_env).supabase_url == "http://pkg"
    assert load_settings({"SUPABASE_URL": "http://env"}, pkg, repo_env).supabase_url == "http://env"
    assert load_settings({}, pkg, repo_env).model == "gemini-x"


def test_api_key_alias():
    s = load_settings({"GOOGLE_GENAI_API_KEY": "abc"}, None, None)
    assert s.google_api_key == "abc" and s.has_model_credentials


def test_missing_key_message_is_spanish_and_names_the_variable():
    s = load_settings({}, None, None)
    try:
        require_model_credentials(s)
    except MissingCredentialsError as exc:
        assert "GOOGLE_API_KEY" in str(exc) and "Falta la clave" in str(exc)
    else:
        raise AssertionError("debía fallar sin clave")


def test_vertex_does_not_need_key():
    assert load_settings({"GOOGLE_GENAI_USE_VERTEXAI": "TRUE"}, None, None).has_model_credentials


def test_explicit_empty_key_disables_repo_fallback(tmp_path):
    from razona_agent.config import load_settings

    repo_env = tmp_path / ".env.local"
    repo_env.write_text("GOOGLE_GENAI_API_KEY=clave-en-env-local\n")
    with_key = load_settings(environ={}, package_env_file=None, repo_env_file=repo_env)
    assert with_key.google_api_key == "clave-en-env-local"
    disabled = load_settings(
        environ={"GOOGLE_API_KEY": ""}, package_env_file=None, repo_env_file=repo_env
    )
    assert disabled.google_api_key is None and not disabled.has_model_credentials
