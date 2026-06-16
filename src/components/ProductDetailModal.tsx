/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Star, MessageSquare, ShoppingCart, Send, ShieldAlert, Sparkles, MapPin, Share2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Product, Review, Artisan } from '../types';

interface ProductDetailModalProps {
  product: Product;
  user: FirebaseUser | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  allReviews: Review[];
  onReviewAdded: () => void;
}

export default function ProductDetailModal({
  product,
  user,
  onClose,
  onAddToCart,
  allReviews,
  onReviewAdded,
}: ProductDetailModalProps) {
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingInput, setRatingInput] = useState(5);
  const [commentInput, setCommentInput] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // States for sharing product link & copying
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // States for Restock Notifications
  const [notificationEmail, setNotificationEmail] = useState('');
  const [notificationSubmitted, setNotificationSubmitted] = useState(false);
  const [isSubmittingNotification, setIsSubmittingNotification] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.email) {
      setNotificationEmail(user.email);
    } else {
      setNotificationEmail('');
    }
    setNotificationSubmitted(false);
    setNotificationError(null);
  }, [product.id, user]);

  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationEmail) return;

    setIsSubmittingNotification(true);
    setNotificationError(null);

    const docId = `${product.id}_${user?.uid || 'guest'}_${Date.now()}`;
    const payload: any = {
      id: docId,
      productId: product.id,
      productTitle: product.title,
      email: notificationEmail,
      createdAt: serverTimestamp(),
    };
    if (user?.uid) {
      payload.userId = user.uid;
    }

    try {
      await setDoc(doc(db, 'stockNotifications', docId), payload);
      setNotificationSubmitted(true);
    } catch (err: any) {
      console.error("Error creating stock notification:", err);
      let errMsg = "Unable to register restock subscription.";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed?.error) {
          errMsg = parsed.error;
        }
      } catch (_) {}
      setNotificationError(errMsg);
    } finally {
      setIsSubmittingNotification(false);
    }
  };

  const handleShare = async () => {
    // Generate functional direct product link
    const directLink = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
    try {
      await navigator.clipboard.writeText(directLink);
      setCopied(true);
      setShowToast(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
    } catch (err) {
      console.error("Failed to copy direct product link:", err);
    }
  };

  // Filter reviews for *this* product
  const productReviews = allReviews.filter(rev => rev.productId === product.id);

  // Fetch product's artisan details
  useEffect(() => {
    async function fetchArtisan() {
      try {
        const docRef = doc(db, 'artisans', product.artisanId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setArtisan(docSnap.data() as Artisan);
        }
      } catch (error) {
        console.error("Error fetching artisan of product:", error);
      }
    }
    fetchArtisan();
  }, [product.artisanId]);

  // Average Rating
  const avgRating = productReviews.length > 0 
    ? productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length 
    : 4.8; // default beautiful indicator if empty

  // Submit Review to Firestore
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (commentInput.trim().length === 0) return;

    setIsSubmittingReview(true);
    setReviewError(null);

    const reviewId = `review_${Date.now()}`;
    const newReview = {
      id: reviewId,
      productId: product.id,
      buyerId: user.uid,
      buyerName: user.displayName || 'Verified Patron',
      rating: Number(ratingInput),
      comment: commentInput.trim(),
      createdAt: serverTimestamp(),
    };

    const reviewPath = `reviews`;
    try {
      // Securely create review
      await addDoc(collection(db, reviewPath), newReview);
      setCommentInput('');
      setRatingInput(5);
      onReviewAdded(); // Notify parent to refresh reviews snapshot
    } catch (error) {
      // Handle security rules violation error or connection drop
      try {
        handleFirestoreError(error, OperationType.CREATE, reviewPath);
      } catch (err: any) {
        setReviewError("Authentication or verification holds failed. Verify you are signed in and have verified email.");
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div id="product_detail_overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div id="product_detail_container" className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-none border border-[#1A1A1A]/20 bg-[#F9F8F6] text-[#1A1A1A] shadow-2xl transition-all flex flex-col md:flex-row">
        
        {/* Close Button - Sharp and Minimal */}
        <button
          id="close_product_detail_btn"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-none border border-[#1A1A1A]/10 bg-[#F9F8F6] text-[#1A1A1A] hover:bg-black hover:text-[#F9F8F6] transition-colors"
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Column 1: Immersive Header Product Image & Artisan Card */}
        <div className="w-full md:w-1/2 p-6 md:p-8 bg-[#EAE8E2]/40 flex flex-col justify-between border-r border-[#1A1A1A]/10">
          <div className="space-y-6">
            {/* Image display */}
            <div className="aspect-square w-full overflow-hidden rounded-none bg-[#EAE8E2] border border-[#1A1A1A]/10 relative">
              <img
                id="product_detail_hero_img"
                src={product.imageUrl}
                alt={product.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-none bg-[#1A1A1A] px-3.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white">
                <Sparkles className="h-3 w-3" />
                {product.category}
              </span>
            </div>

            {/* Artisan Information Card */}
            {artisan ? (
              <div id="artisan_bio_card" className="rounded-none border border-[#1A1A1A]/10 bg-[#F2F1EE] p-5 shadow-none">
                <h4 className="text-[9px] font-sans font-semibold text-[#1A1A1A]/40 tracking-widest uppercase">CRAFTED BY</h4>
                <div className="mt-2.5 flex items-start gap-4">
                  <img
                    id="artisan_bio_img"
                    src={artisan.profileImage}
                    alt={artisan.businessName}
                    className="h-12 w-12 rounded-none border border-[#1A1A1A]/15 object-cover"
                  />
                  <div>
                    <h5 className="text-sm font-bold font-sans text-[#1A1A1A] uppercase tracking-wider">{artisan.businessName}</h5>
                    <div className="flex items-center gap-1 text-[10px] text-[#1A1A1A]/60 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      <span>{artisan.city} Studio</span>
                    </div>
                    <p className="mt-2 text-xs text-[#1A1A1A]/70 leading-relaxed font-serif italic">{artisan.bio}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-pulse rounded-none bg-[#EAE8E2] h-28 w-full" />
            )}
          </div>
        </div>

        {/* Column 2: Details, Reviews and Checkout Actions */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-between bg-[#F9F8F6]">
          <div className="space-y-6">
            <div>
              {/* Stars summary */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-0.5 text-[#1A1A1A]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(avgRating) ? 'fill-[#1A1A1A]' : 'text-[#1A1A1A]/20'}`} />
                  ))}
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#1A1A1A]/70">{avgRating.toFixed(1)} rating</span>
                <span className="text-[10px] text-[#1A1A1A]/45">({productReviews.length} stories)</span>
              </div>

              {/* Product Title - Serif, Italic */}
              <h2 className="text-3xl font-serif italic tracking-tight text-[#1A1A1A] font-medium leading-tight">{product.title}</h2>
              
              {/* Product Price */}
              <p className="mt-2 text-2xl font-serif text-[#1A1A1A] font-light">${product.price}</p>
            </div>

            {/* Product description */}
            <div className="prose prose-sm">
              <h4 className="text-[9px] font-sans font-bold text-[#1A1A1A]/40 tracking-widest uppercase">Specification & Story</h4>
              <p className="mt-2 text-xs font-serif text-[#1A1A1A]/80 leading-relaxed italic">{product.description}</p>
            </div>

            {/* In-Stock Level indicator & Share Craft option */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[11px] uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1A1A1A]/50">Availability:</span>
                {product.stock <= 0 ? (
                  <span className="font-bold text-red-700">Sold Out</span>
                ) : (
                  <span className="font-semibold text-emerald-700">{product.stock} items available in collection</span>
                )}
              </div>

              <button
                type="button"
                id={`share_product_btn_${product.id}`}
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-1.5 rounded-none border border-[#1A1A1A]/20 bg-transparent px-3.5 py-1.5 text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A] hover:bg-black hover:text-white hover:border-black transition-all shadow-none self-start sm:self-auto"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Share Craft Link</span>
                  </>
                )}
              </button>
            </div>

            {/* Product Reviews Lists */}
            <div className="border-t border-[#1A1A1A]/10 pt-6">
              <h4 className="text-[9px] font-sans font-bold text-[#1A1A1A]/40 tracking-widest uppercase flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                Provenance Log & Reviews ({productReviews.length})
              </h4>
              
              <div className="mt-4 space-y-4 max-h-[160px] overflow-y-auto pr-2">
                {productReviews.length === 0 ? (
                  <p className="text-xs text-[#1A1A1A]/50 italic font-serif">No reviews yet for this listing. Be the first to tell yours!</p>
                ) : (
                  productReviews.map((rev) => (
                    <div key={rev.id} className="rounded-none bg-[#F2F1EE] p-4 border border-[#1A1A1A]/5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]">{rev.buyerName}</span>
                        <div className="flex items-center gap-0.5 text-[#1A1A1A]">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < rev.rating ? 'fill-[#1A1A1A]' : 'text-[#1A1A1A]/20'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs font-serif text-[#1A1A1A]/80 leading-relaxed italic">&ldquo;{rev.comment}&rdquo;</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Write a review Form */}
            {user ? (
              <form onSubmit={handleReviewSubmit} className="border-t border-[#1A1A1A]/10 pt-5 space-y-3">
                <h5 className="text-[9px] font-sans font-bold text-[#1A1A1A]/50 tracking-widest uppercase">WRITE A STAMP STORY</h5>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#1A1A1A]/50">Rating:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRatingInput(star)}
                        className="text-[#1A1A1A] focus:outline-none"
                      >
                        <Star className={`h-4 w-4 transition-transform hover:scale-110 ${star <= ratingInput ? 'fill-[#1A1A1A]' : 'text-[#1A1A1A]/20'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <input
                    type="text"
                    required
                    maxLength={1000}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Share your feedback on this craft..."
                    className="flex-1 bg-transparent border-b border-[#1A1A1A]/20 py-2 text-xs uppercase tracking-wider text-[#1A1A1A] placeholder-[#1A1A1A]/35 outline-none focus:border-[#1A1A1A] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="flex h-9 w-9 items-center justify-center rounded-none bg-[#1A1A1A] text-[#F9F8F6] hover:bg-black transition-colors disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>

                {reviewError && (
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-red-700">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    <span>{reviewError}</span>
                  </div>
                )}
              </form>
            ) : (
              <p className="text-[9px] uppercase tracking-wider text-[#1A1A1A]/50 border-t border-[#1A1A1A]/10 pt-4 text-center">
                Please register & sign in to publish verified reviews.
              </p>
            )}

          </div>

          {/* Checkout Adder Section */}
          <div className="mt-8 pt-6 border-t border-[#1A1A1A]/10">
            {product.stock <= 0 ? (
              <div id="restock_notification_form" className="space-y-3 bg-[#F2F1EE] p-4 border border-[#1A1A1A]/5">
                <div>
                  <h4 className="text-[10px] font-sans font-bold text-[#1A1A1A] uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                    Notify Me When Available
                  </h4>
                  <p className="mt-1 text-[11px] font-serif text-[#1A1A1A]/75 leading-relaxed italic">
                    This handcrafted listing is currently sold out. Submit your email to activate restock radar alerts and get direct curator notifications.
                  </p>
                </div>

                {notificationSubmitted ? (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-200/50 p-3 text-[11px] font-sans font-medium flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-700 shrink-0" />
                    <span>Restock alert registered for <b>{notificationEmail}</b>!</span>
                  </div>
                ) : (
                  <form onSubmit={handleNotificationSubmit} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      required
                      value={notificationEmail}
                      onChange={(e) => setNotificationEmail(e.target.value)}
                      placeholder="Enter your email address..."
                      className="flex-grow bg-[#F9F8F6] border border-[#1A1A1A]/15 px-3 py-2 text-xs uppercase tracking-wider text-[#1A1A1A] placeholder-[#1A1A1A]/35 outline-none focus:border-[#1A1A1A] transition-all"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingNotification}
                      className="bg-[#1A1A1A] text-white text-[10px] uppercase font-bold tracking-widest px-4 py-2.5 hover:bg-black transition-colors disabled:opacity-50 font-sans shrink-0"
                    >
                      {isSubmittingNotification ? 'Enrolling...' : 'Alert Me'}
                    </button>
                  </form>
                )}

                {notificationError && (
                  <p className="text-[10px] font-semibold text-red-700 font-sans">⚠ {notificationError}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center border border-[#1A1A1A]/20 rounded-none bg-[#F2F1EE] overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-10 w-9 text-xs font-semibold text-[#1A1A1A] hover:bg-[#1A1A1A]/5"
                  >
                    -
                  </button>
                  <span className="px-3 text-xs font-mono font-bold text-[#1A1A1A]">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="h-10 w-9 text-xs font-semibold text-[#1A1A1A] hover:bg-[#1A1A1A]/5"
                  >
                    +
                  </button>
                </div>

                <button
                  id={`add_to_cart_detail_btn_${product.id}`}
                  onClick={() => {
                    onAddToCart(product, quantity);
                    onClose();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-none bg-[#1A1A1A] h-11 text-[10px] uppercase tracking-[0.25em] font-semibold text-white shadow-none hover:bg-black transition-all"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Acquire Curation ({quantity})
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Subtle Toast Notification confirming the Share Product action */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            id="toast_share_copied"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-[#1A1A1A] text-[#F9F8F6] px-6 py-3.5 border border-[#F9F8F6]/10 shadow-xl flex items-center gap-3.5"
            style={{ minWidth: '320px' }}
          >
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-[9px] font-sans font-bold uppercase tracking-widest text-[#F9F8F6]">Share Link Copied</p>
              <p className="text-[9px] text-[#F9F8F6]/60 font-mono mt-0.5">The custom curation URI is in your clipboard.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
