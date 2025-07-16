# Docker Setup Guide for Face ID Harmonizer Suite

This guide provides comprehensive instructions for containerizing and deploying the Face ID Harmonizer Suite using Docker.

## 📋 Prerequisites

- Docker Desktop installed ([Download here](https://docs.docker.com/get-docker/))
- Docker Compose (included with Docker Desktop)
- Git (for cloning the repository)

## 🚀 Quick Start

### Production Deployment

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd face-id-harmonizer-suite

# 2. Build and run with Docker Compose
docker-compose up -d

# 3. Access the application
# Open http://localhost:8080 in your browser
```

### Development Mode

```bash
# Run development environment with hot-reloading
docker-compose --profile dev up -d face-id-harmonizer-dev

# Access development server at http://localhost:3000
```

## 🔧 Manual Docker Commands

### Build Production Image

```bash
# Build the production image
docker build -t face-id-harmonizer:latest .

# Run the container
docker run -d \
  --name face-id-harmonizer-app \
  -p 8080:80 \
  --restart unless-stopped \
  face-id-harmonizer:latest
```

### Build Development Image

```bash
# Build development image
docker build -f Dockerfile.dev -t face-id-harmonizer:dev .

# Run development container with volume mounting
docker run -d \
  --name face-id-harmonizer-dev \
  -p 3000:3000 \
  -v $(pwd):/app \
  -v /app/node_modules \
  face-id-harmonizer:dev
```

## 🏗️ Architecture Overview

### Production Setup
- **Multi-stage build** for optimized image size
- **Nginx** as web server for static file serving
- **Security headers** and gzip compression enabled
- **Health checks** for container monitoring
- **Non-root user** for enhanced security

### Development Setup
- **Hot-reloading** with Vite dev server
- **Volume mounting** for real-time code changes
- **Development dependencies** included

## 📁 File Structure

```
face-id-harmonizer-suite/
├── Dockerfile              # Production build
├── Dockerfile.dev          # Development build
├── docker-compose.yml      # Container orchestration
├── nginx.conf             # Nginx configuration
├── .dockerignore          # Docker ignore rules
└── DOCKER_SETUP.md        # This guide
```

## ⚙️ Configuration Options

### Environment Variables

```bash
# Production
NODE_ENV=production

# Development
NODE_ENV=development
CHOKIDAR_USEPOLLING=true  # For file watching in containers
```

### Port Configuration

- **Production**: Port 8080 (configurable in docker-compose.yml)
- **Development**: Port 3000 (configurable in docker-compose.yml)

### Volume Mounts

```yaml
# Development volumes
volumes:
  - .:/app                 # Source code
  - /app/node_modules      # Preserve node_modules
  - ./logs:/var/log/nginx  # Nginx logs (optional)
```

## 🔍 Monitoring and Debugging

### View Container Logs

```bash
# Production logs
docker-compose logs -f face-id-harmonizer

# Development logs
docker-compose logs -f face-id-harmonizer-dev

# Nginx access logs
docker exec face-id-harmonizer-app tail -f /var/log/nginx/access.log
```

### Health Checks

```bash
# Check container health
docker ps

# Manual health check
curl -f http://localhost:8080/
```

### Container Shell Access

```bash
# Access production container
docker exec -it face-id-harmonizer-app sh

# Access development container
docker exec -it face-id-harmonizer-dev sh
```

## 🛠️ Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Change port in docker-compose.yml
   ports:
     - "8081:80"  # Use different host port
   ```

2. **Build Failures**
   ```bash
   # Clean build cache
   docker system prune -a
   
   # Rebuild without cache
   docker-compose build --no-cache
   ```

3. **Permission Issues**
   ```bash
   # Fix file permissions (Linux/Mac)
   sudo chown -R $USER:$USER .
   ```

4. **Face Detection Models Not Loading**
   - Ensure internet connectivity for CDN access
   - Check browser console for CORS errors
   - Verify nginx configuration allows external requests

### Performance Optimization

1. **Multi-stage Build Benefits**
   - Smaller production image (~50MB vs ~500MB)
   - No development dependencies in production
   - Faster deployment and startup times

2. **Nginx Optimizations**
   - Gzip compression enabled
   - Static asset caching (1 year)
   - Security headers included

## 🚢 Deployment Options

### Local Development
```bash
docker-compose --profile dev up -d
```

### Production Deployment
```bash
docker-compose up -d
```

### Cloud Deployment

**AWS ECS/Fargate**
```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag face-id-harmonizer:latest <account>.dkr.ecr.us-east-1.amazonaws.com/face-id-harmonizer:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/face-id-harmonizer:latest
```

**Google Cloud Run**
```bash
# Build and push to GCR
docker tag face-id-harmonizer:latest gcr.io/<project-id>/face-id-harmonizer:latest
docker push gcr.io/<project-id>/face-id-harmonizer:latest
```

## 🔒 Security Considerations

- **Non-root user** in containers
- **Security headers** in Nginx configuration
- **Minimal base images** (Alpine Linux)
- **No sensitive files** in Docker context (.dockerignore)
- **Health checks** for monitoring

## 📊 Resource Requirements

### Minimum Requirements
- **CPU**: 1 core
- **Memory**: 512MB
- **Storage**: 1GB

### Recommended for Production
- **CPU**: 2 cores
- **Memory**: 1GB
- **Storage**: 2GB

## 🆘 Support

For issues related to Docker setup:
1. Check container logs
2. Verify port availability
3. Ensure Docker daemon is running
4. Review this documentation

For application-specific issues, refer to the main README.md file.