
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  video?: string;
  category: string;
  inventory: number;
  rating: number;
  reviews: Review[];
  variants?: Variant[];
}

export interface Variant {
  id: string;
  name: string;
  price: number;
}

export interface Review {
  id: string;
  user: string;
  rating: number;
  comment: string;
  date: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  variantId?: string;
  variantName?: string;
}

export interface Order {
  id: string;
  dbId?: number;
  items: CartItem[];
  total: number;
  status: 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled';
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city?: string;
  };
  date: string;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER'
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}
