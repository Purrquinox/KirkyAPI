import "dotenv/config";
import "@sinclair/typebox/compiler";
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { usersRouter } from "./routes/users";
import { postsRouter } from "./routes/posts";
import { commentsRouter } from "./routes/comments";
import { MessageSchema } from "./lib/schemas";

const app = new Elysia()
  .onRequest(({ request }) => {
    console.log(`[${new Date().toISOString()}] ${request.method} ${new URL(request.url).pathname}`);
  })
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "KirkyAPI",
          version: "1.0.0",
          description: "REST API for Kirky — social posts, comments, and user profiles.",
        },
        tags: [
          { name: "Users", description: "User profiles and account management" },
          { name: "Posts", description: "Create, read, update, and delete posts" },
          { name: "Comments", description: "Comments and threaded replies on posts" },
          { name: "System", description: "Health and status endpoints" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          },
        },
      },
    })
  )
  .get("/", () => ({ message: "KirkyAPI is running" }), {
    detail: { tags: ["System"], summary: "Root", security: [] },
    response: { 200: MessageSchema },
  })
  .get("/health", () => ({ status: "ok" }), {
    detail: { tags: ["System"], summary: "Health check", security: [] },
    response: { 200: t.Object({ status: t.String() }) },
  })
  .use(usersRouter)
  .use(postsRouter)
  .use(commentsRouter)
  .listen(process.env.PORT ? Number(process.env.PORT) : 3000);

console.log(`Server running at http://localhost:${app.server?.port}`);
