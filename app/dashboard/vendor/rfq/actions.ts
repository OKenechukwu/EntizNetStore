"use server";

// Deferred subsystem: the RFQ backing tables are not provisioned yet.
// This action exists so the route compiles; it fails explicitly instead of
// faking success. Full RFQ submission belongs to the Vendor/BSM phase.
export async function createRFQ(_formData: FormData): Promise<never> {
  throw new Error("RFQ submission is not available yet.");
}
