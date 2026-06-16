/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Artisan } from '../types';

export const mockArtisans: Artisan[] = [
  {
    id: "artisan_seattle_clay",
    businessName: "Pacific Mudworks",
    bio: "Focusing on functional stoneware that celebrates the textures of the Pacific Northwest. Every mug, bowl, and vase is individually thrown by hand in our Seattle studio.",
    city: "Seattle",
    category: "Pottery",
    profileImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
    ownerId: "artisan_seattle_clay",
    createdAt: new Date()
  },
  {
    id: "artisan_portland_loom",
    businessName: "Indigo & Loom",
    bio: "We weave story and texture into every textile. Sourcing organic Belgian flax and local wool dyed in small indigo batches right in Portland, Oregon.",
    city: "Portland",
    category: "Textiles",
    profileImage: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200",
    ownerId: "artisan_portland_loom",
    createdAt: new Date()
  },
  {
    id: "artisan_asheville_botanicals",
    businessName: "Wild Mountain Botanicals",
    bio: "Hand-forged herbal body care inspired by the rich bio-diversity of the Blue Ridge Mountains. Crafted by hand in Asheville, North Carolina using sustainably harvested plants.",
    city: "Asheville",
    category: "Skincare",
    profileImage: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200",
    ownerId: "artisan_asheville_botanicals",
    createdAt: new Date()
  },
  {
    id: "artisan_denver_wood",
    businessName: "Timber & Grain Woodshop",
    bio: "Turning fallen Colorado hardwoods into elegant, heirloom-quality kitchenware. Every piece features distinct grain variations, hand-carved finishes, and food-grade beeswax sealing.",
    city: "Denver",
    category: "Woodwork",
    profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
    ownerId: "artisan_denver_wood",
    createdAt: new Date()
  }
];

export const mockProducts: Product[] = [
  {
    id: "prod_ceramic_mug",
    artisanId: "artisan_seattle_clay",
    title: "Hand-Thrown Speckled Forest Mug",
    description: "Our signature mug, thrown with dark Oregon clay and glazed in deep pine green and misty gray specks. Perfect weight, with a generous three-finger handle designed to keep hands warm on chilly mornings. Holds roughly 14 oz. Microwave and dishwasher safe.",
    price: 36,
    stock: 12,
    category: "Pottery",
    imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=600",
    location: "Seattle",
    ownerId: "artisan_seattle_clay",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "prod_indigo_throw",
    artisanId: "artisan_portland_loom",
    title: "Organic Linen Waffle Indigo Throw",
    description: "A textured waffle throw blanket woven from premium, European flax and dyed in-house with Japanese natural indigo. Rich, layered indigo tones with soft raw fringe detailing. Adds organic breathability and elegant minimalist styling to any living space or bedroom.",
    price: 125,
    stock: 5,
    category: "Textiles",
    imageUrl: "https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&q=80&w=600",
    location: "Portland",
    ownerId: "artisan_portland_loom",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "prod_walnut_bowl",
    artisanId: "artisan_denver_wood",
    title: "Hand-Carved Black Walnut Salad Bowl",
    description: "Meticulously carved in Colorado from a single solid block of salvaged Black Walnut timber. The deep-set curves are sculpted to display the dynamic natural heartwood grain. Finished with raw linseed oil and organic beeswax to preserve lifetime food-safety.",
    price: 145,
    stock: 2,
    category: "Woodwork",
    imageUrl: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&q=80&w=600",
    location: "Denver",
    ownerId: "artisan_denver_wood",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "prod_bath_salts",
    artisanId: "artisan_asheville_botanicals",
    title: "Wildflower Herb-Infused Mineral Bath Salts",
    description: "A soothing blend of Dead Sea salt, Epsom salt, and coarse Himalayan pink salt. Infused with wild-harvested French lavender buds, mountain calendula flowers, and premium chamomile oil. Promotes deep muscle relaxation and leaves skin feeling incredibly supple.",
    price: 24,
    stock: 25,
    category: "Skincare",
    imageUrl: "https://images.unsplash.com/photo-1608248597481-496100c8c836?auto=format&fit=crop&q=80&w=600",
    location: "Asheville",
    ownerId: "artisan_asheville_botanicals",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "prod_brass_earrings",
    artisanId: "artisan_asheville_botanicals", // Sharing artisan for simplicity or can be customized
    title: "Structured Raw Brass Arch Earrings",
    description: "Articulated geometric dangle earrings, hand-cut from thick solid brass sheet. Rolled with subtle linen texture, antiqued with a dark patina and sealed against tarnish. Lightweight onsterling silver posts.",
    price: 48,
    stock: 8,
    category: "Jewelry",
    imageUrl: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=600",
    location: "Asheville",
    ownerId: "artisan_asheville_botanicals",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "prod_maple_syrup",
    artisanId: "artisan_denver_wood",
    title: "Bourbon-Barrel Smoked Maple Syrup",
    description: "Hand-tapped Colorado maple syrup, slow-smoked over hickory embers and aged for six months in freshly charred organic bourbon barrels. Imparts rich wood-smoke notes paired with classic caramel and oak-vanilla undertones. Phenomenal on waffles, cured salmon, or in craft cocktails.",
    price: 18,
    stock: 30,
    category: "Culinary",
    imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=600",
    location: "Denver",
    ownerId: "artisan_denver_wood",
    createdAt: new Date(),
    updatedAt: new Date()
  }
];
