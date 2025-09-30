# ChemDoc AI - Document Processing System

## Overview

ChemDoc AI is a sophisticated document processing application that automates the extraction and transformation of chemical data from supplier documents. The system uses AI-powered OCR and data extraction to convert supplier certificates of analysis (CoA), technical data sheets (TDS), and material safety data sheets (MSDS) into standardized company formats. Built with React, Express, and Drizzle ORM, it provides a complete workflow from document upload through AI processing to final document generation.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**Migration Completed (2025-08-26):**
- Successfully migrated ChemDoc AI from Replit Agent to standard Replit environment
- Fixed critical data extraction issue where template placeholders were showing instead of actual extracted values
- Implemented data normalization function to map corrupted field names from AI extraction to clean template field names
- Enhanced AI prompt engineering to ensure proper field name consistency
- All core functionality verified and working: document upload, template selection, OCR processing, data extraction, and template preview
- Application running cleanly on port 5000 with proper client/server separation

## Recent Changes

**Migration Completed (2025-08-26):**
- Successfully migrated ChemDoc AI from Replit Agent to standard Replit environment
- Fixed critical data extraction issue where template placeholders were showing instead of actual extracted values
- Implemented data normalization function to map corrupted field names from AI extraction to clean template field names
- Enhanced AI prompt engineering to ensure proper field name consistency
- All core functionality verified and working: document upload, template selection, OCR processing, data extraction, and template preview
- Application running cleanly on port 5000 with proper client/server separation

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components built on Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Component Structure**: Modular components for each workflow step (upload, template selection, processing, data extraction)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **File Handling**: Multer for multipart file uploads with 50MB size limits
- **Storage Pattern**: Repository pattern with in-memory storage for development and interface for database integration
- **API Design**: RESTful endpoints for templates, documents, and processing jobs
- **Error Handling**: Centralized error middleware with proper HTTP status codes

### Data Storage Solutions
- **Primary Database**: PostgreSQL configured through Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Schema Design**: Normalized tables for users, templates, documents, and processing jobs
- **File Storage**: Local filesystem storage for uploaded documents
- **Session Management**: PostgreSQL session store with connect-pg-simple

### Authentication and Authorization
- **Session-based**: Express sessions with PostgreSQL backing store
- **User Model**: Username/password authentication with bcrypt hashing
- **Authorization**: Session validation middleware for protected routes
- **Security**: CORS configuration and request validation

### AI Processing Pipeline
- **OCR Service**: Mistral AI integration for document text extraction
- **Data Extraction**: Mistral LLM for intelligent key-value pair extraction
- **Template Matching**: Dynamic placeholder mapping based on document type
- **Processing Jobs**: Asynchronous job tracking with status updates
- **Accuracy Metrics**: Confidence scoring and token extraction analytics

### External Dependencies

- **Neon Database**: Serverless PostgreSQL database hosting
- **Mistral AI**: OCR and natural language processing for document analysis
- **Radix UI**: Accessible component primitives for UI components
- **TanStack Query**: Server state synchronization and caching
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Drizzle ORM**: Type-safe database queries and migrations
- **Vite**: Fast development server and build tool for frontend assets