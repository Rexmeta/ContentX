import { Router, type IRouter } from "express";
import {
  ListDimensionsResponse,
  CreateDimensionBody,
  CreateDimensionResponse,
  ListCharactersResponse,
  CreateCharacterBody,
  CreateCharacterResponse,
  GetCharacterResponse,
  UpdateCharacterBody,
  UpdateCharacterResponse,
} from "@workspace/api-zod";
import * as dimensionService from "../domains/population/dimensionService";
import {
  InvalidDimensionError,
  DuplicateDimensionError,
} from "../domains/population/dimensionService";
import * as characterService from "../domains/character/service";
import { InvalidCharacterError } from "../domains/character/service";

const router: IRouter = Router();

function pathParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Generated zod schemas strip unknown attribute groups instead of rejecting
 * them. To keep the documented 400 for unknown groups, forward the RAW
 * attributes object to the domain validator (which checks group names,
 * dimension keys, and values) rather than the stripped copy.
 */
function rawAttributes(body: unknown): Record<string, unknown> | undefined {
  if (body && typeof body === "object" && "attributes" in body) {
    return (body as { attributes?: Record<string, unknown> }).attributes;
  }
  return undefined;
}

router.get("/v1/dimensions", async (_req, res): Promise<void> => {
  const dims = await dimensionService.listDimensions();
  res.json(ListDimensionsResponse.parse(dims));
});

router.post("/v1/dimensions", async (req, res): Promise<void> => {
  const parsed = CreateDimensionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const dim = await dimensionService.createDimension(parsed.data);
    res.status(201).json(CreateDimensionResponse.parse(dim));
  } catch (err) {
    if (err instanceof InvalidDimensionError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof DuplicateDimensionError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/v1/characters", async (_req, res): Promise<void> => {
  const characters = await characterService.listCharacters();
  res.json(ListCharactersResponse.parse(characters));
});

router.post("/v1/characters", async (req, res): Promise<void> => {
  const parsed = CreateCharacterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const raw = rawAttributes(req.body);
    const character = await characterService.createCharacter({
      ...parsed.data,
      ...(raw !== undefined ? { attributes: raw } : {}),
    });
    res.status(201).json(CreateCharacterResponse.parse(character));
  } catch (err) {
    if (err instanceof InvalidCharacterError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/v1/characters/:id", async (req, res): Promise<void> => {
  const character = await characterService.getCharacter(
    pathParam(req.params["id"]),
  );
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json(GetCharacterResponse.parse(character));
});

router.patch("/v1/characters/:id", async (req, res): Promise<void> => {
  const parsed = UpdateCharacterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const raw = rawAttributes(req.body);
    const character = await characterService.updateCharacter(
      pathParam(req.params["id"]),
      {
        ...parsed.data,
        ...(raw !== undefined ? { attributes: raw } : {}),
      },
    );
    if (!character) {
      res.status(404).json({ error: "Character not found" });
      return;
    }
    res.json(UpdateCharacterResponse.parse(character));
  } catch (err) {
    if (err instanceof InvalidCharacterError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.delete("/v1/characters/:id", async (req, res): Promise<void> => {
  const deleted = await characterService.deleteCharacter(
    pathParam(req.params["id"]),
  );
  if (!deleted) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
