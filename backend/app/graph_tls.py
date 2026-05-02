"""
TLS verification for outbound HTTPS (Meta Graph API, etc.) and asyncpg.

Windows / HTTPS inspection: ``truststore`` uses the OS trust store. ``certifi`` alone
often misses enterprise roots. Postgres in ``database.py`` uses the same policy.
"""
from __future__ import annotations

import logging
import os
import ssl
from pathlib import Path

import certifi

from app.config import get_settings
from app.debug_agent_log import agent_log

logger = logging.getLogger("salemate.graph_tls")


def os_trusted_ssl_context(*, log_agent: bool = True) -> ssl.SSLContext:
    """
    SSLContext for verifying server certs (httpx, asyncpg, ...).
    Prefer SSL_CERT_FILE / REQUESTS_CA_BUNDLE, else truststore (on non-Linux), else certifi.
    """
    cafile = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    if cafile:
        p = Path(cafile)
        if p.is_file():
            logger.info("TLS: custom CA file %s", cafile)
            if log_agent:
                agent_log(
                    "H1",
                    "graph_tls.py:os_trusted_ssl_context",
                    "verify_choice",
                    {"source": "SSL_CERT_FILE_or_REQUESTS_CA_BUNDLE", "run": "post-fix-v4"},
                    run_id="post-fix-v4",
                )
            return ssl.create_default_context(cafile=str(p.resolve()))
        logger.warning(
            "TLS: SSL_CERT_FILE/REQUESTS_CA_BUNDLE not a readable file (%s)",
            cafile,
        )

    import sys
    if sys.platform != "linux":
        try:
            import truststore
            ctx = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            logger.info("TLS: truststore (OS trust store)")
            if log_agent:
                agent_log(
                    "H1",
                    "graph_tls.py:os_trusted_ssl_context",
                    "ssl_truststore",
                    {"verify_source": "truststore", "run": "post-fix-v4"},
                    run_id="post-fix-v4",
                )
            return ctx
        except Exception as e:
            logger.warning("TLS: truststore failed (%s); using certifi", e)

    bundle = certifi.where()
    logger.info("TLS: certifi bundle")
    vp = ssl.get_default_verify_paths()
    if log_agent:
        agent_log(
            "H1",
            "graph_tls.py:os_trusted_ssl_context",
            "ssl_verify_paths_and_certifi",
            {
                "verify_source": "certifi_fallback",
                "openssl_cafile": getattr(vp, "openssl_cafile", None),
                "certifi_where": bundle,
                "context": "httpx_or_db",
                "run": "post-fix-v4",
            },
            run_id="post-fix-v4",
        )
    return ssl.create_default_context(cafile=bundle)


def graph_https_verify() -> ssl.SSLContext | bool:
    """httpx ``verify``: SSLContext, hoặc ``False`` nếu META_GRAPH_SSL_INSECURE (chỉ khi bắt buộc)."""
    settings = get_settings()
    if settings.META_GRAPH_SSL_INSECURE:
        logger.warning(
            "META_GRAPH_SSL_INSECURE=True — tắt xác minh chứng chỉ HTTPS cho Graph API. "
            "Rủi ro MITM; ưu tiên SSL_CERT_FILE hoặc sửa proxy/antivirus."
        )
        agent_log(
            "H1",
            "graph_tls.py:graph_https_verify",
            "verify_disabled_insecure",
            {"verify_source": "META_GRAPH_SSL_INSECURE", "run": "post-fix-v4"},
            run_id="post-fix-v4",
        )
        return False
    return os_trusted_ssl_context(log_agent=True)
