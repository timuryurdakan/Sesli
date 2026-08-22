FROM python:3.12-slim

WORKDIR /app

# SoundTouch (LGPL v2.1) — no maintained Python binding exists, so the
# `soundstretch` CLI is compiled from source and shelled out to at runtime
# (see app/services/soundstretch.py). Build tools are only needed here, not
# at runtime, but are left installed for image-build simplicity.
RUN apt-get update && apt-get install -y --no-install-recommends \
      git cmake build-essential ca-certificates \
    && git clone --depth 1 https://codeberg.org/soundtouch/soundtouch.git /tmp/soundtouch \
    && cmake -S /tmp/soundtouch -B /tmp/soundtouch/build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /tmp/soundtouch/build --target soundstretch -j"$(nproc)" \
    && cp /tmp/soundtouch/build/soundstretch /usr/local/bin/soundstretch \
    && rm -rf /tmp/soundtouch \
    && apt-get purge -y git cmake build-essential \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Pre-warm the htdemucs_6s model cache at build time so the first real
# request doesn't pay the (~slow, network-dependent) download cost.
RUN python -c "from demucs.api import Separator; Separator(model='htdemucs_6s', device='cpu')"

EXPOSE 8000

# $PORT is injected by the hosting platform (Render/Fly.io/HF Spaces);
# 8000 is the local-dev fallback.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
