FROM public.ecr.aws/docker/library/python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy agent directory
COPY agent/ .

# Install dependencies using uv
RUN uv pip install --system .

# Create non-root user
RUN useradd -m -u 1000 agent_user
USER agent_user

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
