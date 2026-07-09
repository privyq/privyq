# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
# Install the SDK from the monorepo, then the gateway deps.
COPY sdk-python /sdk-python
COPY gateway/requirements.txt gateway/requirements-dev.txt ./
RUN pip install --no-cache-dir /sdk-python && \
    pip install --no-cache-dir fastapi "uvicorn[standard]" "pydantic>=2.6" pydantic-settings "python-jose[cryptography]"
COPY gateway/app ./app
EXPOSE 8000
ENV CORE_ADDRESS=core:50051
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
