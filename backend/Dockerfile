# =============================================================================
# Gruve AI NOC Agent — Backend
# =============================================================================
# Stage 1: dependency builder
FROM python:3.11-slim AS builder

LABEL org.opencontainers.image.title="Gruve NOC Agent Backend" \
      org.opencontainers.image.vendor="Gruve AI"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/venv/bin:${PATH}"

WORKDIR /build
COPY requirements.txt /build/requirements.txt

RUN python -m venv /opt/venv \
    && pip install --upgrade pip \
    && pip install --only-binary=:all: -r /build/requirements.txt || \
       pip install -r /build/requirements.txt

# Stage 2: lean runtime image
FROM python:3.11-slim AS runner

LABEL org.opencontainers.image.title="Gruve NOC Agent Backend" \
      org.opencontainers.image.vendor="Gruve AI"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PATH="/opt/venv/bin:${PATH}" \
    APP_ENV=production \
    APP_PORT=8000

WORKDIR /app

RUN groupadd --system --gid 1001 appgroup \
    && useradd --system --uid 1001 --gid appgroup \
       --home /home/appuser --shell /sbin/nologin appuser

COPY --from=builder /opt/venv /opt/venv
COPY --chown=appuser:appgroup app /app/app

RUN mkdir -p /app/kb_storage /app/data/flows /tmp/hf_home \
    && chown -R appuser:appgroup /app /tmp/hf_home

USER 1001
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--timeout-keep-alive", "30", \
     "--log-level", "info"]
