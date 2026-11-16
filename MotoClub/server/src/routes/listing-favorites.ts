import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { addFavoriteListing, listFavoriteListings, listingFilters, removeFavoriteListing } from "../services/listing-favorites.service.js";

export const listingFavoritesRouter = Router();

listingFavoritesRouter.get("/api/listings/favorites", requireAuth, async (request, response) => {
  response.json({ listings: await listFavoriteListings(request.userId!, listingFilters(request.query)) });
});

listingFavoritesRouter.put<{ id: string }>("/api/listings/:id/favorite", requireAuth, async (request, response) => {
  if (!await addFavoriteListing(request.userId!, request.params.id)) {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Активное объявление не найдено" } });
    return;
  }
  response.json({ isFavorite: true });
});

listingFavoritesRouter.delete<{ id: string }>("/api/listings/:id/favorite", requireAuth, async (request, response) => {
  await removeFavoriteListing(request.userId!, request.params.id);
  response.json({ isFavorite: false });
});
