# Base Image
FROM python:3.12.8-bookworm

# Install required tools (curl, git, Go language, nmap, and Chrome for screenshots)
RUN apt-get update && apt-get install -y \
    curl \
    git \
    gcc \
    build-essential \
    libpcap-dev \
    tcpdump \
    nmap \
    chromium \
    chromium-driver \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Go
RUN curl -OL https://go.dev/dl/go1.23.4.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.23.4.linux-amd64.tar.gz && \
    rm go1.23.4.linux-amd64.tar.gz

# Set Go environment variables
ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/root/go"


# Install httpx, nuclei, subfinder via Go
RUN go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest && \
    go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
    go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest

# Add Go binaries to PATH
ENV PATH="$PATH:/root/go/bin"

# Ensure nmap is installed — separate layer with CACHEBUST to defeat stale apt cache
ARG CACHEBUST=2
RUN apt-get update && apt-get install -y --no-install-recommends nmap && rm -rf /var/lib/apt/lists/*

# Update httpx, nuclei, subfinder
RUN nuclei -update
RUN nuclei -update-templates
RUN httpx -update
RUN subfinder -update

# Copy backend code
WORKDIR /app
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port and start the application
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
