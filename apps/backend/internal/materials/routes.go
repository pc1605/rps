package materials

import "github.com/gofiber/fiber/v2"

// RegisterRoutes mounts the materials API. `admin` is the owner/supervisor role gate (U0 / G4);
// /worker/* routes check the worker token in their handlers.
func RegisterRoutes(api fiber.Router, svc *Service, admin fiber.Handler) {
	h := NewHandler(svc)

	api.Get("/materials/types", admin, h.ListTypes)
	api.Post("/materials/types", admin, h.CreateType)
	api.Patch("/materials/types/:id", admin, h.UpdateType)
	api.Get("/materials/types/:id/variants", admin, h.ListVariants)
	api.Post("/materials/types/:id/variants", admin, h.CreateVariant)
	api.Patch("/materials/variants/:id", admin, h.UpdateVariant)

	api.Get("/materials/lots", admin, h.ListLots)
	api.Post("/materials/lots", admin, h.Receive)
	api.Patch("/materials/lots/:id", admin, h.PatchLot)
	api.Post("/materials/lots/:id/adjust", admin, h.Adjust)
	api.Post("/materials/lots/:id/waste", admin, h.Waste)
	api.Post("/materials/lots/:id/return", admin, h.Return)

	api.Get("/materials/movements", admin, h.ListMovements)

	api.Get("/consumption-groups", admin, h.ListGroups)
	api.Post("/consumption-groups", admin, h.CreateGroup)
	api.Patch("/consumption-groups/:id", admin, h.UpdateGroup)

	api.Get("/recipes", admin, h.RecipeGrid)
	api.Get("/recipes/resolve", admin, h.Resolve)
	api.Put("/recipes/:product_line_id/:group_id/lines", admin, h.PutRecipeLines)
	api.Get("/car-models/:id/material-overrides", admin, h.GetOverrides)
	api.Put("/car-models/:id/material-overrides", admin, h.PutOverrides)

	api.Get("/batches/:id/materials", admin, h.BatchMaterials)
	// Worker (cutter) route — handler checks the worker token + station.
	api.Get("/worker/batches/:id/materials-needed", h.MaterialsNeeded)
}
