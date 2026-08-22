FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Pre-warm the htdemucs_6s model cache at build time so the first real
# request doesn't pay the (~slow, network-dependent) download cost.
RUN python -c "from demucs.api import Separator; Separator(model='htdemucs_6s', device='cpu')"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
