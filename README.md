AfriLink

AfriLink is an African-first affiliate marketplace platform that connects vendors, affiliates, and buyers in a single ecosystem. Vendors list products, affiliates promote them using unique links, and buyers purchase through a seamless checkout system.

The goal of AfriLink is to unlock affiliate marketing across Africa by providing a trusted platform where vendors can scale sales and affiliates can earn commissions.

Overview

AfriLink consists of three main systems:

Main Application

Vendor and affiliate dashboards

Product management

Affiliate link generation

Earnings tracking

Checkout System

Buyer-facing product landing pages

Checkout flow

Affiliate attribution tracking

Order creation and delivery confirmation

Admin Portal

Platform monitoring

Order management

Vendor oversight

Marketplace management

All systems share the same backend database.

Architecture

Frontend:

Vite + React

Backend:

Supabase (authentication, database, and edge functions)

Hosting:

Vercel

Domains:

Main platform: https://afrilink.info

Checkout system: https://shop.afrilink.info

Core Features
Vendors

Create and manage products

Track incoming orders

Manage delivery updates

View earnings

Affiliates

Browse products to promote

Generate unique affiliate links

Track performance and commissions

Buyers

Open affiliate links without creating an account

Purchase products through a secure checkout

Confirm delivery via secure confirmation link

Affiliate Link Flow

Affiliate links follow this format:

https://shop.afrilink.info/p/<productSlug>?ref=<affiliateCode>

Flow:

Affiliate shares the link

Buyer opens the product page

Buyer clicks Buy Now

Checkout records the affiliate reference

Order is created in the database

Vendor fulfills delivery

Buyer confirms delivery

Affiliate commission is unlocked

Environment Variables

The checkout system requires the following environment variables.

Vite
VITE_APP_URL=https://shop.afrilink.info
VITE_SUPABASE_URL=<supabase_project_url>
VITE_SUPABASE_ANON_KEY=<supabase_anon_key>

These must be configured in the Vercel project settings.

Development Setup

Clone the repository:

git clone https://github.com/your-username/afrilink.git

Install dependencies:

npm install

Run locally:

npm run dev

The app will start at:

http://localhost:5173
Database

AfriLink uses Supabase for data storage and authentication.

Main tables include:

users

vendors

affiliates

products

orders

affiliate_links

Row Level Security (RLS) is used to ensure vendors and affiliates only access their own data.

Security Considerations

Vendor contact details are not exposed to buyers

Orders are accessed using secure confirmation tokens

Affiliate attribution is stored with each order

Environment secrets are stored in platform configuration (not in code)

Project Status

AfriLink is currently in active development.

Phase 1 focuses on:

Core marketplace functionality

Affiliate link tracking

Checkout and order creation

Delivery confirmation flow

Future phases will include:

SMS notifications

Payment integrations

Vendor verification

Affiliate analytics

Contributing

Contributions are welcome.

Fork the repository

Create a new branch

Make changes

Submit a pull request
