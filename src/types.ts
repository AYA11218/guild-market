/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Artisan {
  id: string; // matches ownerId/uid
  businessName: string;
  bio: string;
  city: string;
  category: string;
  profileImage: string;
  ownerId: string;
  createdAt: any; // Firestore Timestamp
}

export interface Product {
  id: string;
  artisanId: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  imageUrl: string;
  location: string;
  ownerId: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface Review {
  id: string;
  productId: string;
  buyerId: string;
  buyerName: string;
  rating: number;
  comment: string;
  createdAt: any; // Firestore Timestamp
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  artisanId: string;
}

export interface Order {
  id: string;
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  items: OrderItem[];
  totalAmount: number;
  paymentStatus: "pending" | "succeeded" | "failed";
  shippingAddress: string;
  cardBrand: string;
  last4: string;
  transactionId: string;
  createdAt: any; // Firestore Timestamp
  paymentMethodType?: string;
  paymentMethodDetails?: string;
}
