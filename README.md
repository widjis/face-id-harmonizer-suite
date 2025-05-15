
# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/0fa91db3-77b7-4063-97e3-b6f609c7b3e8

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/0fa91db3-77b7-4063-97e3-b6f609c7b3e8) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Docker Deployment

To deploy this application using Docker, follow these steps:

### Prerequisites
- Docker installed on your machine ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose (optional, for easier management)

### Step 1: Create a Dockerfile
Create a file named `Dockerfile` in the root directory of your project with the following content:

```dockerfile
# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config if needed
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Step 2: Create a .dockerignore file
Create a `.dockerignore` file in the root directory to exclude unnecessary files:

```
node_modules
npm-debug.log
.git
.github
.gitignore
README.md
```

### Step 3: Build the Docker image
Run the following command from the project root directory:

```sh
docker build -t id-card-image-converter .
```

### Step 4: Run the Docker container
After the build completes, run the container:

```sh
docker run -p 8080:80 --name id-card-app id-card-image-converter
```

This will map port 8080 on your host to port 80 in the container. You can access the application at http://localhost:8080.

### Step 5 (Optional): Using Docker Compose
For easier management, you can create a `docker-compose.yml` file:

```yaml
version: '3'
services:
  app:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
```

Then run:

```sh
docker-compose up -d
```

To stop the container:

```sh
docker-compose down
```

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/0fa91db3-77b7-4063-97e3-b6f609c7b3e8) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
