
# 🎯 Face ID Harmonizer Suite

<div align="center">
  <img src="public/MTI-removebg-preview.png" alt="MTI Logo" width="200"/>
  
  **AI-Powered Employee Image Processing & Data Management System**
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Docker Deployment](#-docker-deployment)
- [Usage Guide](#-usage-guide)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

The **Face ID Harmonizer Suite** is a modern web application designed for HR departments and administrative teams to process employee photographs and data efficiently. Using AI-powered face detection technology, it automatically crops and standardizes employee photos while processing Excel data into machine-readable formats.

### 🎪 Key Capabilities

- **🤖 AI Face Detection**: Automatic face recognition and intelligent cropping
- **📊 Excel Processing**: Smart data consolidation from multiple sources
- **🎨 Batch Operations**: Process hundreds of files simultaneously
- **📱 Responsive Design**: Works seamlessly on desktop and mobile
- **🐳 Production Ready**: Complete Docker deployment setup

---

## ✨ Features

### 🖼️ **Image Processing**
- **Smart Face Detection**: Uses face-api.js with SSD MobileNet v1
- **Adaptive Cropping**: Adjustable radius (5-100%) for perfect framing
- **Employee ID Extraction**: Intelligent parsing of various ID formats (MTI12345, numbers, etc.)
- **Standardized Output**: 400x400px JPEG images optimized for ID systems
- **Batch Processing**: ZIP file generation for easy download

### 📈 **Excel Data Management**
- **Smart Header Mapping**: Automatically maps various column names to standard format
- **Multi-file Consolidation**: Combines data from multiple Excel sources
- **Dual Format Export**: Generates both Excel (.xlsx) and CSV files
- **Date-stamped Output**: `For_Machine_DD-MM-YYYY.xlsx` and `CardDatafileformat_DD-MM-YYYY.csv`
- **Data Validation**: Ensures data integrity and completeness

### 🎨 **User Experience**
- **Drag & Drop Interface**: Modern file upload with visual feedback
- **Real-time Progress**: Loading indicators and status updates
- **Error Handling**: Comprehensive error management with user-friendly messages
- **Processing Modes**: Images-only or combined image+Excel processing
- **Mobile Responsive**: Optimized for all device sizes

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for server state
- **Routing**: React Router DOM
- **UI Components**: Radix UI primitives with custom styling

### **AI & Processing**
- **Face Detection**: face-api.js with pre-trained models
- **File Processing**: xlsx for Excel, jszip for compression
- **Image Manipulation**: Canvas API for cropping and resizing

### **Development & Deployment**
- **Package Manager**: npm with bun.lockb support
- **Linting**: ESLint with TypeScript rules
- **Containerization**: Docker with multi-stage builds
- **Web Server**: Nginx for production serving
- **Health Monitoring**: Built-in health checks

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 20+ ([Install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- **npm** or **bun** package manager
- **Docker** (optional, for containerized deployment)

### Local Development

```bash
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd face-id-harmonizer-suite

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open in browser
# Navigate to http://localhost:3000
```

### Build for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 🐳 Docker Deployment

### Quick Production Deployment

```bash
# Start production container
docker-compose up -d

# Access application at http://localhost:9003
```

### Development with Hot Reload

```bash
# Start development container with file watching
docker-compose --profile dev up -d face-id-harmonizer-dev

# Access development server at http://localhost:3000
```

### Available Services

| Service | Port | Environment | Description |
|---------|------|-------------|-------------|
| `face-id-harmonizer` | 9003 | Production | Nginx-served optimized build |
| `face-id-harmonizer-dev` | 3000 | Development | Vite dev server with hot reload |

### Docker Features
- ✅ Multi-stage builds for optimized images
- ✅ Nginx with security headers and gzip compression
- ✅ Health checks and monitoring
- ✅ Non-root user for enhanced security
- ✅ Volume mounting for development

For detailed Docker setup, see [DOCKER_SETUP.md](./DOCKER_SETUP.md)

---

## 📖 Usage Guide

### 1. **Processing Images Only**

1. Select "Process Images Only" mode
2. Drag & drop or browse for image files (JPG, JPEG, PNG)
3. Adjust the adaptive radius percentage (5-100%)
4. Click "Process Images"
5. Download the generated ZIP file containing cropped faces

### 2. **Processing Images + Excel Data**

1. Select "Process Images and Excel Files" mode
2. Upload image files in the first drop zone
3. Upload Excel files (.xlsx, .xls) in the second drop zone
4. Adjust processing parameters
5. Click "Process Images & Generate Excel Files"
6. Download both the image ZIP and generated Excel/CSV files

### 3. **Supported File Formats**

#### Images
- **Input**: JPG, JPEG, PNG
- **Output**: 400x400px JPEG (95% quality)

#### Excel Files
- **Input**: .xlsx, .xls
- **Expected Columns**: Emp. No, Name, Department, Section, Job Title, MessHall
- **Output**: Excel (.xlsx) and CSV formats with date stamps

### 4. **Employee ID Formats**

The system intelligently extracts employee IDs from filenames:
- `MTI12345 - John Doe.jpg` → `MTI12345`
- `MTI12345_John_Doe.jpg` → `MTI12345`
- `12345.John.Doe.jpg` → `12345`
- `Employee_12345.jpg` → `12345`

---

## 🏗️ Project Structure

```
face-id-harmonizer-suite/
├── 📁 public/                    # Static assets
│   ├── 🖼️ MTI-removebg-preview.png # Company logo
│   ├── 📁 models/                # Face detection models
│   └── 🤖 *.json, *-shard*       # Pre-trained AI models
├── 📁 src/
│   ├── 📁 components/            # React components
│   │   ├── 🎯 ImageProcessor.tsx # AI face detection & processing
│   │   ├── 📊 ExcelProcessor.tsx # Excel data management
│   │   ├── 📤 FileDropZone.tsx   # File upload interface
│   │   └── 📁 ui/                # shadcn/ui components
│   ├── 📁 hooks/                 # Custom React hooks
│   ├── 📁 lib/                   # Utility functions
│   ├── 📁 pages/                 # Application pages
│   │   ├── 🏠 Index.tsx          # Main application page
│   │   └── ❌ NotFound.tsx       # 404 error page
│   ├── 🎨 App.tsx                # Root application component
│   └── 🚀 main.tsx               # Application entry point
├── 🐳 Dockerfile                 # Production container
├── 🛠️ Dockerfile.dev             # Development container
├── 🐙 docker-compose.yml         # Container orchestration
├── ⚙️ vite.config.ts             # Vite configuration
├── 🎨 tailwind.config.ts         # Tailwind CSS config
└── 📦 package.json               # Dependencies & scripts
```

---

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run build:dev    # Build in development mode
npm run preview      # Preview production build
npm run lint         # Run ESLint

# Docker
docker-compose up -d                           # Production deployment
docker-compose --profile dev up -d             # Development with hot reload
docker-compose down                            # Stop all services
```

### Environment Variables

Create a `.env` file for custom configuration:

```env
# Development
VITE_API_URL=http://localhost:3000
NODE_ENV=development

# Production
NODE_ENV=production
```

### Code Quality

- **TypeScript**: Strict type checking enabled
- **ESLint**: Configured with React and TypeScript rules
- **Prettier**: Code formatting (configure in your IDE)
- **Tailwind CSS**: Utility-first styling approach

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use shadcn/ui components for consistency
- Write responsive designs with Tailwind CSS
- Add proper error handling
- Include JSDoc comments for complex functions
- Test Docker builds before submitting

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

For support and questions:

- 📧 **Email**: [support@mti.com](mailto:support@mti.com)
- 📖 **Documentation**: [Project Wiki](https://github.com/your-org/face-id-harmonizer-suite/wiki)
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-org/face-id-harmonizer-suite/issues)

---

<div align="center">
  <p>Made with ❤️ by the MTI Development Team</p>
  <p>© 2025 MTI. All rights reserved.</p>
</div>
