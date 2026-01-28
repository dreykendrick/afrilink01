import { Product, User, VendorStats, AffiliateStats, Application } from '@/types';

export const products: Product[] = [
  {
    id: '1',
    title: 'Digital Marketing Course',
    description: 'Master social media marketing',
    price: 150000,
    commission: 30,
    category: 'Education',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
    status: 'approved',
    sales: 45,
  },
  {
    id: '2',
    title: 'E-Commerce Guide',
    description: 'Launch your online store',
    price: 85000,
    commission: 25,
    category: 'Business',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
    status: 'approved',
    sales: 32,
  },
  {
    id: '3',
    title: 'SEO Toolkit',
    description: 'Boost your rankings',
    price: 120000,
    commission: 35,
    category: 'Marketing',
    image: 'https://images.unsplash.com/photo-1571677208015-f0c8c82d9d36?w=800&q=80',
    status: 'approved',
    sales: 28,
  },
];

export const users: Record<string, User> = {
  vendor: { id: '1', name: 'John Kamau', email: 'john@example.com', role: 'vendor', wallet: 850000 },
  affiliate: { id: '2', name: 'Amina Hassan', email: 'amina@example.com', role: 'affiliate', wallet: 320000 },
  consumer: { id: '3', name: 'David Mwanga', email: 'david@example.com', role: 'consumer', wallet: 50000 },
};

export const vendorStats: VendorStats = {
  revenue: 2850000,
  sales: 105,
  products: 3,
  pending: 1,
};

export const affiliateStats: AffiliateStats = {
  commission: 320000,
  clicks: 856,
  conversions: 42,
  rate: 4.9,
};

export const applications: Application[] = [
  {
    id: 1,
    userId: 5,
    userName: 'Sarah Omondi',
    email: 'sarah@example.com',
    role: 'vendor',
    status: 'pending',
    appliedAt: '2025-01-15T10:30:00Z',
    businessName: 'Digital Pro Solutions',
    description: 'We specialize in digital marketing tools and courses for African businesses.',
  },
  {
    id: 2,
    userId: 6,
    userName: 'Michael Kipchoge',
    email: 'michael@example.com',
    role: 'affiliate',
    status: 'pending',
    appliedAt: '2025-01-16T14:20:00Z',
    description: 'Experienced digital marketer with 50k+ followers on social media platforms.',
  },
  {
    id: 3,
    userId: 7,
    userName: 'Grace Wanjiku',
    email: 'grace@example.com',
    role: 'vendor',
    status: 'pending',
    appliedAt: '2025-01-17T09:15:00Z',
    businessName: 'E-Learning Hub Africa',
    description: 'Online education platform offering courses in technology and business.',
  },
  {
    id: 4,
    userId: 8,
    userName: 'James Mwangi',
    email: 'james@example.com',
    role: 'affiliate',
    status: 'pending',
    appliedAt: '2025-01-18T11:45:00Z',
    description: 'Content creator focusing on tech reviews and entrepreneurship.',
  },
];

