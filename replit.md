# EntizNet Store

## Overview

EntizNet is a Next.js 14 marketplace application built with TypeScript and App Router featuring a sophisticated dual brand architecture. The platform serves as a comprehensive luxury adult marketplace with two distinct brand experiences: EntizNetStore (warm luxury gold/ivory theme) and PrimeDiscreet (sophisticated champagne/charcoal theme). Users can browse products, manage inventory, handle orders through an escrow system, and enjoy brand-specific experiences with dedicated seller dashboards, KYC verification, and premium theming.

## Recent Changes

### October 2025 - Auth Sign-in Fix, BSM/Seller Links, i18n & Currency
- **Sign-in Link Fixed**: Header "Sign in" now correctly routes to `/auth?mode=signin` instead of 404 `/auth/signin`
- **Compatibility Route**: Created `/auth/signin` redirect for backward compatibility
- **Footer BSM/Seller Links**: Updated footer to route "Become a Seller", "Sell as BSM", and "BSM Dashboard" to `/auth?mode=signin` with role parameters
- **Auth Guards**: Added server-side auth checks to `/seller/apply` and `/bsm/apply` pages that redirect unauthenticated users
- **Language & Currency Persistence**: Verified full cookie + localStorage persistence system working via LanguageCurrencySwitcher
- **formatMoney Utility**: Currency formatter in lib/currency.ts for consistent price display across the app
- **Auto-Detection**: Currency automatically detects from user locale/timezone on first visit

### October 2025 - 3-Role Auth System & BSM Integration
- **3-Role Auth System**: Auth page supports Buyer/Seller/BSM tabs with helper text
- **Role-Based Routing**: Profile icon routes to `/auth?mode=signin` when logged out, or role-based dashboard when authenticated
- **BSM Footer Section**: Added BSM links to footer with proper routing
- **Centralized Routing**: All role redirects use lib/auth/routeByRole.ts helper

### October 2025 - Royal Desire (Option A) Design Transformation
- **Royal Desire Color Palette**: Transformed site with luxury purple (#7A00D1), gold (#D1B000), and velvet black (#0B0A0D) branding
- **Two-Level Navigation**: Implemented TopBar (logo, primary links, search, language+currency, auth icons) + MainNav (category tabs) system
- **Full-Width Layout**: Removed all max-width constraints for true edge-to-edge design with 70vh hero slider
- **Categories Grid**: Exact 2-row × 8-column layout (16 total) with responsive breakpoints and fast hover effects
- **Featured Sections**: Created 9 reusable product showcase sections with ratings, prices, and smooth animations
- **Language & Currency**: Single dropdown component with localStorage persistence for user preferences
- **New Routes**: Added /premium, /luxury, /collections, /smart-devices, /gift-sets pages
- **Security**: Updated CSP in middleware.ts to allow Google Fonts (Cormorant Garamond serif + Inter sans)
- **Documentation**: Created docs/ui-notes.md with comprehensive UI architecture guide

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