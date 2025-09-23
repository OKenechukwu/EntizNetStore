# EntizNet Store

## Overview

EntizNet is a Next.js 14 marketplace application built with TypeScript and App Router featuring a sophisticated dual brand architecture. The platform serves as a comprehensive luxury adult marketplace with two distinct brand experiences: EntizNetStore (warm luxury gold/ivory theme) and PrimeDiscreet (sophisticated champagne/charcoal theme). Users can browse products, manage inventory, handle orders through an escrow system, and enjoy brand-specific experiences with dedicated seller dashboards, KYC verification, and premium theming.

## Recent Changes

### December 2024 - Dual Brand Architecture Implementation
- **Dual Brand System**: Implemented sophisticated dual brand architecture with EntizNetStore (luxury gold/ivory theme) and PrimeDiscreet (premium champagne/charcoal theme)
- **Dynamic Theming**: Advanced theming system with real-time CSS variable switching, brand-specific color schemes, and responsive design transitions
- **Brand-Specific Routing**: Added `/entiznet` and `/primediscreet` routes with automatic brand context switching and localStorage persistence
- **Database Enhancement**: Added `marketplace_brand` field to products table for brand-specific filtering and categorization
- **Product Filtering**: Comprehensive brand-aware filtering system with distinct categories, pricing tiers, and featured tags per brand
- **Brand Provider System**: React context-based brand management with theme application and state persistence
- **Seller Customization**: Brand-aware components allowing sellers to choose their marketplace brand and customize storefront experiences

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 14 with App Router for modern React patterns and file-based routing
- **TypeScript**: Full type safety across the application
- **Styling**: Tailwind CSS for utility-first styling with custom CSS variables for dark/light theme support
- **Components**: Client-side components for interactive features, server components for data fetching
- **Navigation**: Built-in Link components with a sticky header navigation system

### Backend Architecture
- **API Routes**: Next.js App Router API routes for server-side logic
- **Database**: Supabase PostgreSQL with Row Level Security (RLS) policies
- **Authentication**: Supabase Auth with email/password authentication
- **File Storage**: Supabase Storage for product images with public bucket access
- **State Management**: React hooks and Supabase client for data fetching and auth state

### Database Design
- **Products Table**: Stores product information with owner relationships for multi-vendor support
- **Orders Table**: Manages purchase transactions with status tracking
- **Escrow Table**: Handles payment escrow for secure transactions
- **RLS Policies**: Ensures users can only access their own data while maintaining public read access for products

### Authentication & Authorization
- **Provider Pattern**: Supabase client initialization with environment variables
- **Route Protection**: Client-side auth guards that redirect unauthenticated users
- **User Context**: Session management through Supabase auth state
- **Role-based Access**: Owner-based permissions for product and order management

### File Management
- **Image Uploads**: Direct uploads to Supabase Storage with size limits (12MB)
- **Public Access**: Product images served through public bucket URLs
- **Path Structure**: Organized file storage with product-specific directories

## External Dependencies

### Core Services
- **Supabase**: Backend-as-a-Service providing PostgreSQL database, authentication, and file storage
- **Next.js**: React framework for full-stack web applications
- **React/React-DOM**: Frontend library for user interface components

### Development Tools
- **TypeScript**: Static type checking and enhanced developer experience
- **ESLint**: Code linting with Next.js configuration
- **Tailwind CSS**: Utility-first CSS framework with PostCSS integration
- **Autoprefixer**: CSS vendor prefix automation

### Storage Configuration
- **Bucket**: `store-products` for public product image storage
- **Environment Variables**: Supabase URL and anonymous key for client configuration
- **File Types**: Image uploads with MIME type validation

### API Integration
- **Supabase Client**: Browser and server-side database queries
- **Row Level Security**: Database-level access control
- **Real-time**: Potential for live updates through Supabase subscriptions