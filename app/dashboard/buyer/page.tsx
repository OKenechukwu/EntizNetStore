// app/dashboard/buyer/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { updateBuyerProfile } from "@/lib/auth";

// Country select + data
import CountrySelect from "@/components/forms/CountrySelect";
import { countries as COUNTRIES_LIST } from "@/data/countries";

/** ----------------------------
 * Types
 * -----------------------------*/
interface BuyerProfileForm {
  display_name: string;
  first_name: string;
  last_name: string;
  gender: "male" | "female" | "non-binary" | "prefer-not-to-say" | "";
  date_of_birth: string;
  country: string; // ISO-3166-1 alpha-2 (e.g., "DE", "PH")
  phone: string;
  interests: string[];
}

/** ----------------------------
 * Constants
 * -----------------------------*/
const INTEREST_OPTIONS = [
  "Adult Toys & Accessories",
  "Adult Dolls & Figures",
  "Erotic Clothing & Underwear",
  "Sexual Health & Education",
  "Erotic Massage & Relaxation",
  "Lingerie & Intimates",
  "Health & Wellness",
  "Books & Media",
  "Fashion & Beauty",
  "Home & Lifestyle",
  "Art & Collectibles",
  "Technology & Gadgets",
  "Jewelry & Accessories",
];

// Build quick lookup maps for code<->name
const CODE_TO_NAME = new Map(COUNTRIES_LIST.map((c) => [c.code, c.name]));
const NAME_TO_CODE = new Map(
  COUNTRIES_LIST.map((c) => [c.name.toLowerCase(), c.code]),
);

/** ----------------------------
 * Helpers
 * -----------------------------*/
// Normalize an incoming country value (code or name) to ISO code
function normalizeCountryToCode(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length === 2 && CODE_TO_NAME.has(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }
  // try match by name (case-insensitive)
  const byName = NAME_TO_CODE.get(trimmed.toLowerCase());
  return byName ?? "";
}

// Get display name from a stored code, with graceful fallback
function displayCountryName(codeOrName: string): string {
  if (!codeOrName) return "Not set";
  const code = normalizeCountryToCode(codeOrName);
  if (code && CODE_TO_NAME.has(code)) return CODE_TO_NAME.get(code)!;
  // fallback: show original value (probably a name previously stored)
  return codeOrName;
}

/** ----------------------------
 * Component
 * -----------------------------*/
export default function BuyerDashboardPage() {
  const { user, loading, refreshProfile } = useAuth();
  const router = useRouter();

  // Local form state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [buyerForm, setBuyerForm] = useState<BuyerProfileForm>({
    display_name: "",
    first_name: "",
    last_name: "",
    gender: "",
    date_of_birth: "",
    country: "",
    phone: "",
    interests: [],
  });

  // Redirect rules
  useEffect(() => {
    if (loading) return;

    // Not authenticated → sign-in
    if (!user) {
      router.replace("/auth/sign-in");
      return;
    }

    // Bounce only users WITHOUT buyer capability. A buyer+seller user
    // keeps access to buyer pages (capabilities are never collapsed).
    if (user.isBuyer === false) {
      router.replace(user.isSeller ? "/dashboard/seller" : "/store");
    }
  }, [loading, user, router]);

  // Populate form from profile
  useEffect(() => {
    if (!user?.profile) return;

    // We only expect buyer profiles on this route
    const profile = user.profile as any;
    setBuyerForm({
      display_name: profile.display_name || "",
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      gender: profile.gender || "",
      date_of_birth: profile.date_of_birth || "",
      // Normalize here so UI is consistent and saves as ISO code
      country: normalizeCountryToCode(profile.country) || "",
      phone: profile.phone || "",
      interests: Array.isArray(profile.interests)
        ? profile.interests
        : profile.interests
          ? [profile.interests]
          : [],
    });
  }, [user?.profile]);

  const handleSaveBuyerProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Ensure we persist ISO code (2 letters) for country
      const countryCode = normalizeCountryToCode(buyerForm.country);
      await updateBuyerProfile(user.id, {
        ...buyerForm,
        gender: buyerForm.gender || undefined,
        country: countryCode, // store code like "DE"
        updated_at: new Date().toISOString(),
      });

      await refreshProfile();
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating buyer profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setBuyerForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  // Loading & guard states
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="opacity-80">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user || user.isBuyer === false) {
    return null; // redirects handled above
  }

  /** ----------------------------
   * UI
   * -----------------------------*/
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-accent-gold mb-2">
              My Profile
            </h1>
            <p className="opacity-80">
              Manage your buyer account information and preferences
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard/buyer/orders"
              className="luxury-button-outline px-4 py-2"
            >
              My Orders
            </Link>
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="luxury-button-outline px-4 py-2"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBuyerProfile}
                  disabled={isSaving}
                  className="luxury-button px-4 py-2 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="luxury-button px-4 py-2"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="glass-card p-6">
        <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">
          Account Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">
              Email Address
            </label>
            <p className="p-3 bg-charcoal/10 rounded-lg opacity-80">
              {user.email}
            </p>
            <p className="text-xs opacity-60 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Account Type
            </label>
            <p className="p-3 bg-charcoal/10 rounded-lg opacity-80 capitalize">
              {user.role}
            </p>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="glass-card p-6">
        <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">
          Personal Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Display Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={buyerForm.display_name}
                onChange={(e) =>
                  setBuyerForm((prev) => ({
                    ...prev,
                    display_name: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                placeholder="How others see you"
              />
            ) : (
              <p className="p-3 bg-charcoal/10 rounded-lg">
                {buyerForm.display_name || "Not set"}
              </p>
            )}
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium mb-2">Gender</label>
            {isEditing ? (
              <select
                value={buyerForm.gender}
                onChange={(e) =>
                  setBuyerForm((prev) => ({
                    ...prev,
                    gender: e.target.value as BuyerProfileForm["gender"],
                  }))
                }
                className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            ) : (
              <p className="p-3 bg-charcoal/10 rounded-lg">
                {buyerForm.gender || "Not specified"}
              </p>
            )}
          </div>

          {/* First Name */}
          <div>
            <label className="block text-sm font-medium mb-2">First Name</label>
            {isEditing ? (
              <input
                type="text"
                value={buyerForm.first_name}
                onChange={(e) =>
                  setBuyerForm((prev) => ({
                    ...prev,
                    first_name: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
              />
            ) : (
              <p className="p-3 bg-charcoal/10 rounded-lg">
                {buyerForm.first_name || "Not set"}
              </p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Last Name</label>
            {isEditing ? (
              <input
                type="text"
                value={buyerForm.last_name}
                onChange={(e) =>
                  setBuyerForm((prev) => ({
                    ...prev,
                    last_name: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
              />
            ) : (
              <p className="p-3 bg-charcoal/10 rounded-lg">
                {buyerForm.last_name || "Not set"}
              </p>
            )}
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Date of Birth
            </label>
            {isEditing ? (
              <input
                type="date"
                value={buyerForm.date_of_birth}
                onChange={(e) =>
                  setBuyerForm((prev) => ({
                    ...prev,
                    date_of_birth: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
              />
            ) : (
              <p className="p-3 bg-charcoal/10 rounded-lg">
                {buyerForm.date_of_birth
                  ? new Date(buyerForm.date_of_birth).toLocaleDateString()
                  : "Not set"}
              </p>
            )}
          </div>

          {/* COUNTRY FIELD - uses CountrySelect */}
          <div>
            <label className="block text-sm font-medium mb-2">Country</label>
            {isEditing ? (
              <CountrySelect
                value={buyerForm.country}
                onChange={(c) =>
                  setBuyerForm((prev) => ({ ...prev, country: c }))
                }
                placeholder="Select your country..."
              />
            ) : (
              <p className="p-3 bg-charcoal/10 rounded-lg">
                {displayCountryName(buyerForm.country)}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-2">Phone</label>
            {isEditing ? (
              <input
                type="tel"
                value={buyerForm.phone}
                onChange={(e) =>
                  setBuyerForm((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                placeholder="+49 1512 3456789"
              />
            ) : (
              <p className="p-3 bg-charcoal/10 rounded-lg">
                {buyerForm.phone || "Not set"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Interests */}
      <div className="glass-card p-6">
        <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">
          Shopping Interests
        </h2>

        {isEditing ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {INTEREST_OPTIONS.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className={`p-3 rounded-lg border text-sm transition-colors ${
                  buyerForm.interests.includes(interest)
                    ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                    : "border-accent-gold/30 hover:border-accent-gold/50"
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {buyerForm.interests.length > 0 ? (
              buyerForm.interests.map((interest) => (
                <span
                  key={interest}
                  className="px-3 py-1 bg-accent-gold/20 text-accent-gold rounded-full text-sm"
                >
                  {interest}
                </span>
              ))
            ) : (
              <p className="opacity-60">No interests selected</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
