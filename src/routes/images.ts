import Elysia, { t } from "elysia";
import { authPlugin } from "../lib/auth";
import { ErrorSchema, ImageUploadResponseSchema } from "../lib/schemas";
import { uploadToBytePurr } from "../lib/upload";

const security = [{ bearerAuth: [] }];

export const imagesRouter = new Elysia({ prefix: "/images" })
  .use(authPlugin)
  .post(
    "/upload",
    async ({ userId, body, query, set }) => {
      try {
        const url = await uploadToBytePurr(body.file, userId, query.directory);
        set.status = 201;
        return { url };
      } catch {
        set.status = 502;
        return { error: "Image upload failed" };
      }
    },
    {
      detail: { tags: ["Images"], summary: "Upload an image", security },
      body: t.Object({ file: t.File({ maxSize: "10m" }) }),
      query: t.Object({
        directory: t.Union([
          t.Literal("ProfilePicture"),
          t.Literal("BannerImage"),
          t.Literal("PostImage"),
        ]),
      }),
      response: {
        201: ImageUploadResponseSchema,
        502: ErrorSchema,
        401: ErrorSchema,
        503: ErrorSchema,
      },
    }
  );
