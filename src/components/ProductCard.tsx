/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MapPin, Star, Sparkles, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Product } from '../types';

interface ProductCardProps {
  key?: string;
  product: Product;
  onSelect: (product: Product) => void;
  ratingAverage?: number;
  reviewCount?: number;
}

// Staggerable item variants for clean editorial load & filter animation feel
export const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'tween',
      ease: [0.16, 1, 0.3, 1], // Custom elegant cubic bezier for high-end feel
      duration: 0.6
    }
  },
  exit: {
    opacity: 0,
    y: 10,
    transition: {
      duration: 0.2
    }
  }
};

export default function ProductCard({
  product,
  onSelect,
  ratingAverage = 4.8, // Fallback if no reviews exist
  reviewCount = 3,
}: ProductCardProps) {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 3;

  return (
    <motion.div
      id={`product_card_${product.id}`}
      onClick={() => onSelect(product)}
      variants={itemVariants}
      className="group relative flex flex-col overflow-hidden rounded-none border border-[#1A1A1A]/10 bg-[#F9F8F6] transition-all duration-300 hover:border-[#1A1A1A]/30 cursor-pointer"
    >
      {/* Product Image Stage */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#EAE8E2]">
        <img
          id={`product_card_img_${product.id}`}
          src={product.imageUrl}
          alt={product.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Category Badge */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-none bg-[#F9F8F6]/95 border border-[#1A1A1A]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A] shadow-none">
          <Sparkles className="h-2.5 w-2.5 text-amber-900" />
          {product.category}
        </span>

        {/* Local City Badge - MapPin is elegant */}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-none bg-[#1A1A1A] px-2.5 py-1 text-[9px] font-medium uppercase tracking-widest text-white shadow-none">
          <MapPin className="h-2.5 w-2.5 text-[#F9F8F6]" />
          {product.location}
        </span>

        {/* Stock Alert Badge */}
        {isOutOfStock ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#F9F8F6]/75 backdrop-blur-[1px]">
            <span className="rounded-none bg-[#1A1A1A] border border-[#1A1A1A] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-none">
              Sold Out
            </span>
          </div>
        ) : isLowStock ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-none bg-red-50 border border-red-250/30 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-widest text-red-700 shadow-none">
            <AlertCircle className="h-3 w-3" />
            Only {product.stock} left
          </span>
        ) : null}
      </div>

      {/* Product Information Card Body */}
      <div className="flex flex-1 flex-col p-6 bg-[#F9F8F6]">
        <div className="flex items-center justify-between gap-2 mb-2">
          {/* Average Rating */}
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-[#1A1A1A] text-[#1A1A1A]" />
            <span className="text-[10px] font-bold tracking-wider text-[#1A1A1A]">{ratingAverage.toFixed(1)}</span>
            <span className="text-[9px] text-[#1A1A1A]/50">({reviewCount})</span>
          </div>
        </div>

        {/* Product Title */}
        <h3 className="text-base font-serif italic font-medium tracking-tight text-[#1A1A1A] line-clamp-1 group-hover:underline transition-all">
          {product.title}
        </h3>

        {/* Product Description */}
        <p className="mt-2 text-xs font-serif text-[#1A1A1A]/70 line-clamp-2 leading-relaxed italic">
          {product.description}
        </p>

        {/* Price & Primary Call to Action */}
        <div className="mt-auto pt-4 flex items-end justify-between border-t border-[#1A1A1A]/10">
          <div>
            <span className="text-[9px] font-sans text-[#1A1A1A]/40 tracking-widest uppercase block">PROVENANCE</span>
            <span className="text-base font-serif font-semibold text-[#1A1A1A]">${product.price}</span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#1A1A1A] hover:opacity-60 transition-opacity">
            Details &rarr;
          </span>
        </div>
      </div>
    </motion.div>
  );
}
