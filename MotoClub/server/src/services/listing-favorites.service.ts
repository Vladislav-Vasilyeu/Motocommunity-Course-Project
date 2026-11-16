import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";

export const sellerSummary = { id: true, displayName: true, profile: { select: { city: true } } };

export function listingFilters(query: Record<string, unknown>): Prisma.ListingWhereInput {
  const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const q = text(query.q);
  const category = text(query.category);
  const city = text(query.city);
  return {
    ...(category ? { category } : {}),
    ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
    ...(q ? { OR: [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ] } : {}),
  };
}

export async function listFavoriteListings(userId: string, filters: Prisma.ListingWhereInput) {
  const favorites = await prisma.listingFavorite.findMany({
    where: { userId, listing: filters },
    orderBy: [{ createdAt: "desc" }, { listingId: "desc" }],
    select: { listing: { include: { seller: { select: sellerSummary } } } },
  });
  return favorites.map(({ listing }) => ({ ...listing, isFavorite: true }));
}

export async function addFavoriteListing(userId: string, listingId: string) {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: listingId, status: "ACTIVE" }, select: { id: true } });
    if (!listing) return false;
    await prisma.listingFavorite.createMany({ data: { userId, listingId }, skipDuplicates: true });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return false;
    throw error;
  }
}

export async function removeFavoriteListing(userId: string, listingId: string) {
  await prisma.listingFavorite.deleteMany({ where: { userId, listingId } });
}
