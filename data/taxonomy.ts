export interface CategoryItem {
  id: string
  name: string
  slug: string
  description: string
  image?: string
  subcategories?: CategoryItem[]
}

export const adultWellnessTaxonomy: CategoryItem[] = [
  {
    id: 'masturbator',
    name: 'Masturbators',
    slug: 'masturbators',
    description: 'Premium male pleasure products for enhanced intimate experiences',
    image: '/images/categories/masturbators.jpg',
    subcategories: [
      {
        id: 'automatic-masturbators',
        name: 'Automatic Masturbators',
        slug: 'automatic-masturbators',
        description: 'High-tech automatic devices for hands-free pleasure'
      },
      {
        id: 'masturbator-cups',
        name: 'Masturbator Cups',
        slug: 'masturbator-cups',
        description: 'Textured sleeve masturbators for realistic sensations'
      },
      {
        id: 'pocket-pussy',
        name: 'Pocket Pussy',
        slug: 'pocket-pussy',
        description: 'Discreet and portable intimate toys'
      },
      {
        id: 'penis-pumps',
        name: 'Penis Pumps',
        slug: 'penis-pumps',
        description: 'Enhancement devices for size and performance'
      },
      {
        id: 'blowjob-toys',
        name: 'Blowjob Toys',
        slug: 'blowjob-toys',
        description: 'Oral simulation devices for realistic experiences'
      }
    ]
  },
  {
    id: 'vibrators',
    name: 'Vibrators',
    slug: 'vibrators',
    description: 'Luxury vibrating devices for ultimate pleasure and satisfaction',
    image: '/images/categories/vibrators.jpg',
    subcategories: [
      {
        id: 'rose-vibrators',
        name: 'Rose Vibrators',
        slug: 'rose-vibrators',
        description: 'Elegant floral-inspired clitoral stimulators'
      },
      {
        id: 'tongue-vibrators',
        name: 'Tongue Vibrators',
        slug: 'tongue-vibrators',
        description: 'Oral-inspired stimulation devices'
      },
      {
        id: 'rabbit-vibrators',
        name: 'Rabbit Vibrators',
        slug: 'rabbit-vibrators',
        description: 'Dual stimulation for G-spot and clitoral pleasure'
      },
      {
        id: 'clitoral-vibrators',
        name: 'Clitoral Vibrators',
        slug: 'clitoral-vibrators',
        description: 'Targeted external stimulation devices'
      },
      {
        id: 'butterfly-vibrators',
        name: 'Butterfly Vibrators',
        slug: 'butterfly-vibrators',
        description: 'Wearable vibrators for discreet pleasure'
      },
      {
        id: 'bullet-vibrators',
        name: 'Bullet Vibrators',
        slug: 'bullet-vibrators',
        description: 'Compact and powerful mini vibrators'
      },
      {
        id: 'wearable-vibrators',
        name: 'Wearable Vibrators',
        slug: 'wearable-vibrators',
        description: 'Hands-free pleasure devices for intimate moments'
      },
      {
        id: 'g-spot-vibrators',
        name: 'G-Spot Vibrators',
        slug: 'g-spot-vibrators',
        description: 'Curved vibrators for internal pleasure'
      },
      {
        id: 'wand-massagers',
        name: 'Wand Massagers',
        slug: 'wand-massagers',
        description: 'Powerful massage devices for full-body pleasure'
      },
      {
        id: 'quiet-vibrators',
        name: 'Quiet Vibrators',
        slug: 'quiet-vibrators',
        description: 'Discreet low-noise pleasure devices'
      }
    ]
  },
  {
    id: 'dildos',
    name: 'Dildos',
    slug: 'dildos',
    description: 'Premium penetrative toys in various sizes and materials',
    image: '/images/categories/dildos.jpg',
    subcategories: [
      {
        id: 'strap-on-dildos',
        name: 'Strap-On Dildos',
        slug: 'strap-on-dildos',
        description: 'Harness-compatible toys for partner play'
      },
      {
        id: 'anal-dildos',
        name: 'Anal Dildos',
        slug: 'anal-dildos',
        description: 'Specially designed for safe anal exploration'
      },
      {
        id: 'double-dildos',
        name: 'Double Dildos',
        slug: 'double-dildos',
        description: 'Double-ended toys for shared pleasure'
      },
      {
        id: 'huge-dildos',
        name: 'Huge Dildos',
        slug: 'huge-dildos',
        description: 'Extra-large toys for advanced users'
      },
      {
        id: 'realistic-dildos',
        name: 'Realistic Dildos',
        slug: 'realistic-dildos',
        description: 'Lifelike designs with realistic textures'
      },
      {
        id: 'thrusting-dildos',
        name: 'Thrusting Dildos',
        slug: 'thrusting-dildos',
        description: 'Motorized toys with thrusting action'
      },
      {
        id: 'squirting-dildos',
        name: 'Squirting Dildos',
        slug: 'squirting-dildos',
        description: 'Toys with ejaculation simulation features'
      },
      {
        id: 'silicone-dildos',
        name: 'Silicone Dildos',
        slug: 'silicone-dildos',
        description: 'Body-safe premium silicone toys'
      }
    ]
  },
  {
    id: 'sex-dolls',
    name: 'Sex Dolls',
    slug: 'sex-dolls',
    description: 'Realistic life-size companions for intimate experiences',
    image: '/images/categories/sex-dolls.jpg',
    subcategories: [
      {
        id: 'white-female-sex-doll',
        name: 'White Female Sex Dolls',
        slug: 'white-female-sex-dolls',
        description: 'Realistic female companions with Caucasian features'
      },
      {
        id: 'black-female-sex-doll',
        name: 'Black Female Sex Dolls',
        slug: 'black-female-sex-dolls',
        description: 'Beautiful African-inspired female companions'
      },
      {
        id: 'asian-female-sex-doll',
        name: 'Asian Female Sex Dolls',
        slug: 'asian-female-sex-dolls',
        description: 'Elegant Asian-inspired female companions'
      },
      {
        id: 'white-male-sex-doll',
        name: 'White Male Sex Dolls',
        slug: 'white-male-sex-dolls',
        description: 'Masculine Caucasian-featured companions'
      },
      {
        id: 'black-male-sex-doll',
        name: 'Black Male Sex Dolls',
        slug: 'black-male-sex-dolls',
        description: 'Strong African-inspired male companions'
      },
      {
        id: 'asian-male-sex-doll',
        name: 'Asian Male Sex Dolls',
        slug: 'asian-male-sex-dolls',
        description: 'Handsome Asian-inspired male companions'
      },
      {
        id: 'realistic-sex-butts',
        name: 'Realistic Sex Butts',
        slug: 'realistic-sex-butts',
        description: 'Anatomically correct lower torso toys'
      },
      {
        id: 'sex-torso',
        name: 'Sex Torsos',
        slug: 'sex-torsos',
        description: 'Upper body companions with realistic features'
      }
    ]
  },
  {
    id: 'couple-toys',
    name: 'Couple Toys',
    slug: 'couple-toys',
    description: 'Enhance intimacy and connection with your partner',
    image: '/images/categories/couple-toys.jpg',
    subcategories: [
      {
        id: 'cock-rings',
        name: 'Cock Rings',
        slug: 'cock-rings',
        description: 'Enhancement rings for prolonged pleasure'
      },
      {
        id: 'penis-sleeves',
        name: 'Penis Sleeves',
        slug: 'penis-sleeves',
        description: 'Textured extensions for enhanced sensations'
      },
      {
        id: 'penis-trainer',
        name: 'Penis Trainers',
        slug: 'penis-trainers',
        description: 'Training devices for stamina and endurance'
      },
      {
        id: 'bdsm',
        name: 'BDSM',
        slug: 'bdsm',
        description: 'Bondage and discipline accessories for adventurous couples'
      }
    ]
  },
  {
    id: 'anal-toys',
    name: 'Anal Toys',
    slug: 'anal-toys',
    description: 'Safe and comfortable toys designed for anal exploration',
    image: '/images/categories/anal-toys.jpg',
    subcategories: [
      {
        id: 'prostate-massagers',
        name: 'Prostate Massagers',
        slug: 'prostate-massagers',
        description: 'Targeted P-spot stimulation devices'
      },
      {
        id: 'butt-plugs',
        name: 'Butt Plugs',
        slug: 'butt-plugs',
        description: 'Safe plugs for gradual anal training'
      },
      {
        id: 'anal-beads',
        name: 'Anal Beads',
        slug: 'anal-beads',
        description: 'Graduated beads for progressive stimulation'
      },
      {
        id: 'anal-douches',
        name: 'Anal Douches',
        slug: 'anal-douches',
        description: 'Hygiene products for comfortable preparation'
      },
      {
        id: 'anal-hooks',
        name: 'Anal Hooks',
        slug: 'anal-hooks',
        description: 'Advanced toys for experienced users'
      },
      {
        id: 'tails',
        name: 'Tails',
        slug: 'tails',
        description: 'Fantasy-inspired tail plugs for role play'
      }
    ]
  }
];

// Navigation menu structure for mega menu
export const megaMenuSections = [
  {
    title: 'Store',
    sections: [
      { name: 'New Arrivals', image: '/images/menu/new-arrivals.jpg', description: 'Latest luxury products', link: '/new-arrivals' },
      { name: 'Best Sellers', image: '/images/menu/best-sellers.jpg', description: 'Most popular items', link: '/best-sellers' },
      { name: 'Premium Collection', image: '/images/menu/premium.jpg', description: 'Exclusive luxury products', link: '/premium' },
      { name: 'Sale Items', image: '/images/menu/sale.jpg', description: 'Special offers and discounts', link: '/sale' }
    ]
  },
  {
    title: 'Categories',
    sections: adultWellnessTaxonomy.slice(0, 4).map(cat => ({
      name: cat.name,
      image: cat.image || '/images/menu/default-category.jpg',
      description: cat.description,
      link: `/categories/${cat.slug}`
    }))
  },
  {
    title: 'Brands',
    sections: [
      { name: 'Luxury Brands', image: '/images/menu/luxury-brands.jpg', description: 'Premium international brands', link: '/brands/luxury' },
      { name: 'Eco-Friendly', image: '/images/menu/eco-friendly.jpg', description: 'Sustainable and natural products', link: '/brands/eco' },
      { name: 'Tech-Enabled', image: '/images/menu/tech.jpg', description: 'Smart and connected devices', link: '/brands/tech' },
      { name: 'Artisan Crafted', image: '/images/menu/artisan.jpg', description: 'Handcrafted premium items', link: '/brands/artisan' }
    ]
  },
  {
    title: 'Popular',
    sections: [
      { name: 'Trending Now', image: '/images/menu/trending.jpg', description: 'What\'s hot this month', link: '/trending' },
      { name: 'Customer Favorites', image: '/images/menu/favorites.jpg', description: 'Top-rated by customers', link: '/favorites' },
      { name: 'Gift Ideas', image: '/images/menu/gifts.jpg', description: 'Perfect presents for partners', link: '/gifts' },
      { name: 'Beginner Friendly', image: '/images/menu/beginner.jpg', description: 'Perfect for first-time users', link: '/beginner' }
    ]
  },
  {
    title: 'On Sale',
    sections: [
      { name: 'Flash Deals', image: '/images/menu/flash.jpg', description: 'Limited time offers', link: '/flash-deals' },
      { name: 'Clearance', image: '/images/menu/clearance.jpg', description: 'Final sale items', link: '/clearance' },
      { name: 'Bundle Offers', image: '/images/menu/bundles.jpg', description: 'Save with combo deals', link: '/bundles' },
      { name: 'Loyalty Rewards', image: '/images/menu/rewards.jpg', description: 'Exclusive member discounts', link: '/rewards' }
    ]
  }
];