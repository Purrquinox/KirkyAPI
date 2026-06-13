import "dotenv/config";
import "@sinclair/typebox/compiler";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { usersRouter } from "./routes/users";
import { postsRouter } from "./routes/posts";
import { commentsRouter } from "./routes/comments";

const app = new Elysia()
  .onRequest(({ request }) => {
    console.log(`[${new Date().toISOString()}] ${request.method} ${new URL(request.url).pathname}`);
  })
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: { title: "KirkyAPI", version: "1.0.0" },
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer" },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    })
  )
  .get("/", () => ({ message: "KirkyAPI is running" }))
  .get("/health", () => ({ status: "ok" }))
  .use(usersRouter)
  .use(postsRouter)
  .use(commentsRouter)
  .listen(process.env.PORT ? Number(process.env.PORT) : 3000);

console.log(`Server running at http://localhost:${app.server?.port}`);
