
import { Product } from './types';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'w1',
    name: 'MEER Royal Oak Skeleton',
    description: 'A masterpiece of horological engineering. This ITX SHOP MEER exclusive features an intricate open-worked dial, showcasing the high-performance mechanical movement in a precision-crafted stainless steel case.',
    price: 45000,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1200',
    video: 'https://player.vimeo.com/external/494252666.sd.mp4?s=7228890a367611df978302cc9313106da487c52f&profile_id=165',
    category: 'Luxury Artisan',
    inventory: 5,
    rating: 5,
    reviews: [],
    variants: [
      { id: 'v1', name: 'Rose Gold Finish', price: 48000 },
      { id: 'v2', name: 'Brushed Titanium', price: 45000 }
    ]
  },
  {
    id: 'w2',
    name: 'ITX Nautilus Deep Sea',
    description: 'Designed for the modern professional explorer. Water-resistant up to 300 meters, featuring a luminous dial for optimal legibility and a unidirectional rotating bezel.',
    price: 28500,
    image: 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?auto=format&fit=crop&q=80&w=1200',
    category: 'Professional Series',
    inventory: 12,
    rating: 4.8,
    reviews: []
  },
  {
    id: 'w3',
    name: 'Heritage Minimalist MEER',
    description: 'A minimalist expression of timeless elegance. Features a monochromatic dial paired with a premium hand-stitched leather strap, perfect for formal and business attire.',
    price: 18000,
    image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&q=80&w=1200',
    category: 'Minimalist / Heritage',
    inventory: 15,
    rating: 4.7,
    reviews: []
  }
];

export const TRUST_BADGES = [
  { icon: 'fa-certificate', text: 'Certified Authentic' },
  { icon: 'fa-truck-fast', text: 'Cash On Delivery' },
  { icon: 'fa-shield-halved', text: '5-Year MEER Warranty' },
  { icon: 'fa-box-open', text: 'Premium Packaging' }
];
