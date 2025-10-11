// components/nav/MegaMenu.tsx
"use client";

import { useState, useRef, useEffect, ReactNode, KeyboardEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useBrand } from "@/components/BrandProvider";
import { CATEGORIES } from "@/data/categories";

// === Types (keep your original props) ===
interface MenuSection {
  name: string;
  image?: string; // optional if using card mode
  description?: string; // optional if using card mode
  link: string;
}

interface MegaMenuProps {
  trigger: ReactNode;
  sections?: MenuSection[]; // if provided -> card grid mode
  title?: string;
  className?: string;
  isOpen?: boolean; // for mobile control
  onToggle?: () => void; // for mobile control
}

/** Helper: normalize possibly-varied category shapes into a consistent shape */
type AnySub = { name: string; slug: string };
type AnyCat = {
  name: string;
  slug: string;
  icon?: ReactNode | string;
  subcategories?: AnySub[];
  sub?: AnySub[];
  children?: AnySub[];
};

function normalizeCategories(
  raw: AnyCat[] | undefined,
): Array<AnyCat & { subcategories: AnySub[] }> {
  return (raw ?? []).map((c) => {
    const subs =
      (Array.isArray(c.subcategories) && c.subcategories) ||
      (Array.isArray(c.sub) && c.sub) ||
      (Array.isArray(c.children) && c.children) ||
      [];
    return { ...c, subcategories: subs };
  });
}

/**
 * MegaMenu
 *
 * - If `sections` are provided: shows your original "card grid" layout (image + description).
 * - If no `sections`: shows category → subcategory columns from /data/categories (auto-wired).
 * - Desktop: opens on hover; Mobile: opens with onToggle.
 */
export default function MegaMenu({
  trigger,
  sections,
  title = "Shop by Category",
  className = "",
  isOpen = false,
  onToggle,
}: MegaMenuProps) {
  const { theme } = useBrand();
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Responsive check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024); // lg breakpoint
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Close on outside click (mobile only)
  useEffect(() => {
    if (!isMobile) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if (onToggle && isOpen) onToggle();
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile, isOpen, onToggle]);

  const handleMouseEnter = () => {
    if (isMobile) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    timeoutRef.current = setTimeout(() => setIsHovered(false), 120);
  };

  const handleClick = () => {
    if (isMobile && onToggle) onToggle();
  };

  const isMenuOpen = isMobile ? isOpen : isHovered;

  // Global Escape to close
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isMobile && onToggle) onToggle();
        else setIsHovered(false);
        setTimeout(() => triggerRef.current?.focus(), 0);
      }
    };
    document.addEventListener("keydown", onKey as any);
    return () => document.removeEventListener("keydown", onKey as any);
  }, [isMenuOpen, isMobile, onToggle]);

  // Keyboard on trigger
  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (isMenuOpen) {
        if (isMobile && onToggle) onToggle();
        else setIsHovered(false);
        setTimeout(() => triggerRef.current?.focus(), 0);
      }
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isMobile && onToggle) onToggle();
      else setIsHovered((v) => !v);
    }
  };

  // Shared container styles
  const containerClass = `absolute top-full left-1/2 -translate-x-1/2 mt-2 w-screen max-w-5xl z-50 ${
    isMobile ? "fixed inset-x-4 top-[72px] translate-x-0 w-auto max-w-none" : ""
  }`;

  const surfaceStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.glass.border,
    boxShadow: theme.colors.shadow.luxury,
  };

  return (
    <div
      ref={menuRef}
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger */}
      <div
        ref={triggerRef}
        className="cursor-pointer"
        onClick={handleClick}
        onKeyDown={onTriggerKeyDown}
        tabIndex={0}
        role="button"
        aria-haspopup="true"
        aria-expanded={isMenuOpen}
        aria-label={`${title} menu`}
      >
        {trigger}
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={containerClass}
            style={surfaceStyle}
            role="menu"
            aria-label={`${title} navigation menu`}
          >
            <div
              className="rounded-2xl border overflow-hidden backdrop-blur-sm"
              style={surfaceStyle}
            >
              {/* Header */}
              <div
                className="px-6 py-4 border-b flex items-center justify-between"
                style={{ borderColor: theme.colors.glass.border }}
              >
                <h3
                  className="text-xl font-serif font-bold"
                  style={{ color: theme.colors.text.primary }}
                >
                  {title}
                </h3>

                {isMobile && onToggle && (
                  <button
                    onClick={onToggle}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Close menu"
                  >
                    <svg
                      className="w-6 h-6"
                      style={{ color: theme.colors.text.primary }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                {sections && sections.length > 0 ? (
                  // === Card Grid Mode (your original prop-based layout) ===
                  <CardGrid sections={sections} />
                ) : (
                  // === Category → Subcategory Columns (auto-wired from /data/categories) ===
                  <CategoryColumns />
                )}

                {/* View All */}
                <div className="mt-8 text-center">
                  <Link
                    href="/categories"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-brandPink hover:bg-brandPink-600 text-white font-semibold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brandPink"
                    role="menuitem"
                    aria-label="View all product categories"
                  >
                    <span>View All Categories</span>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Card grid layout (uses `sections`) — preserves your original look */
function CardGrid({ sections }: { sections: MenuSection[] }) {
  const { theme } = useBrand();
  const cols =
    sections.length <= 4
      ? `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(4, sections.length)}`
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid gap-6 ${cols}`} role="group" aria-label="Menu items">
      {sections.map((section, idx) => (
        <motion.div
          key={section.name}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05, duration: 0.3 }}
        >
          <Link
            href={section.link}
            className="group block p-4 rounded-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brandPink focus:ring-offset-2"
            style={{
              backgroundColor: `${theme.colors.glass.bg}50`,
              borderColor: theme.colors.glass.border,
            }}
            role="menuitem"
            aria-label={`Navigate to ${section.name}${section.description ? `: ${section.description}` : ""}`}
          >
            {/* Image (optional) */}
            {section.image && (
              <div className="relative aspect-video rounded-lg overflow-hidden mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={section.image}
                  alt={section.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).src =
                      "/images/placeholder.jpg")
                  }
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-2 right-2">
                    <div
                      className="w-8 h-8 rounded-full bg-brandPink flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <h4
              className="font-semibold text-lg mb-2 group-hover:text-brandPink transition-colors duration-300"
              style={{ color: theme.colors.text.primary }}
            >
              {section.name}
            </h4>
            {section.description && (
              <p
                className="text-sm leading-relaxed line-clamp-2"
                style={{ color: theme.colors.text.secondary }}
              >
                {section.description}
              </p>
            )}

            <div
              className="mt-3 flex items-center text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0"
              style={{ color: theme.colors.accent }}
              aria-hidden="true"
            >
              <span>Explore</span>
              <svg
                className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

/** Category → Subcategory columns (auto from /data/categories) */
function CategoryColumns() {
  const { theme } = useBrand();

  // Normalize and guard against undefined data/keys
  const cats = normalizeCategories((CATEGORIES as unknown as AnyCat[]) ?? []);

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      role="group"
      aria-label="Category list"
    >
      {cats.map((cat, idx) => (
        <motion.div
          key={cat.slug}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.04, duration: 0.24 }}
        >
          <div
            className="rounded-xl p-4 border"
            style={{
              borderColor: theme.colors.glass.border,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Link
              href={`/categories/${cat.slug}`}
              className="flex items-center gap-2 mb-3 group"
            >
              <span className="text-xl">{cat.icon ?? "•"}</span>
              <h4
                className="font-semibold group-hover:text-brandPink transition-colors"
                style={{ color: theme.colors.text.primary }}
              >
                {cat.name}
              </h4>
            </Link>

            <ul className="space-y-1">
              {(cat.subcategories ?? []).map((sub) => (
                <li key={sub.slug}>
                  <Link
                    href={`/categories/${cat.slug}/${sub.slug}`}
                    className="text-sm rounded-md px-2 py-1 inline-block hover:bg-accent/10 transition"
                    style={{ color: theme.colors.text.secondary }}
                  >
                    {sub.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// === Mobile-friendly hamburger toggle (unchanged API) ===
export function MobileMenuToggle({
  isOpen,
  onToggle,
  className = "",
}: {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { theme } = useBrand();

  return (
    <button
      onClick={onToggle}
      className={`relative w-10 h-10 flex flex-col items-center justify-center space-y-1 transition-all duration-300 ${className}`}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      aria-expanded={isOpen}
    >
      <motion.span
        animate={{ rotate: isOpen ? 45 : 0, y: isOpen ? 8 : 0 }}
        className="w-6 h-0.5 rounded-full transition-all duration-300"
        style={{ backgroundColor: theme.colors.text.primary }}
      />
      <motion.span
        animate={{ opacity: isOpen ? 0 : 1 }}
        className="w-6 h-0.5 rounded-full transition-all duration-300"
        style={{ backgroundColor: theme.colors.text.primary }}
      />
      <motion.span
        animate={{ rotate: isOpen ? -45 : 0, y: isOpen ? -8 : 0 }}
        className="w-6 h-0.5 rounded-full transition-all duration-300"
        style={{ backgroundColor: theme.colors.text.primary }}
      />
    </button>
  );
}
