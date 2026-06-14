# Images

Images are uploaded to the Kirky CDN via [BytePurr](https://bytepurr.purrquinox.com). You can either upload a file in the same request as the resource you're creating/updating, or use the standalone `POST /images/upload` endpoint to get a URL first.

---

## Endpoints

| Method | Path             | Description                           |
|--------|------------------|---------------------------------------|
| `POST` | `/images/upload` | Upload an image and get back a URL    |

Endpoints that accept `imageFile`, `avatarFile`, or `bannerImageFile` fields handle the upload internally and store the resulting URL — no separate call needed.

---

## Directories

BytePurr organises uploads by intended use. The directory is inferred automatically when uploading via a resource endpoint. For the standalone `/images/upload` endpoint, pass it as the `directory` query parameter.

| Value            | Used by                                        |
|------------------|------------------------------------------------|
| `ProfilePicture` | `avatarFile` on `PATCH /users/me`              |
| `BannerImage`    | `bannerImageFile` on `PATCH /users/me`         |
| `PostImage`      | `imageFile` on `POST /posts`, `PATCH /posts/:id`, `POST /posts/:id/comments` |

---

## Uploading via a Resource Endpoint

Send `multipart/form-data` and include the file field alongside the normal body fields. The server uploads to BytePurr and sets the resulting URL on the record atomically.

**Profile avatar (one request):**

```bash
curl -X PATCH "https://api.kirky.app/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatarFile=@avatar.jpg" \
  -F "bio=Building Kirky."
```

**Post with image (one request):**

```bash
curl -X POST "https://api.kirky.app/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -F "content=Check out this photo!" \
  -F "imageFile=@photo.jpg"
```

If both a file field (`imageFile`) and a URL field (`imageUrl`) are supplied, the file takes precedence.

---

## Standalone Upload

**`POST /images/upload`**

Upload a file and receive a CDN URL to use wherever you like. Useful when you want to preview an image before submitting it, or when building a client that handles upload separately.

### Query Parameters

| Parameter   | Type   | Required | Values                                           |
|-------------|--------|----------|--------------------------------------------------|
| `directory` | string | Yes      | `ProfilePicture` \| `BannerImage` \| `PostImage` |

### Request Body (`multipart/form-data`)

| Field  | Type | Required | Constraints | Description          |
|--------|------|----------|-------------|----------------------|
| `file` | file | Yes      | Max 10 MB   | Image file to upload |

### Response `201`

| Field | Type   | Description                        |
|-------|--------|------------------------------------|
| `url` | string | Full CDN URL of the uploaded image |

```json
{ "url": "https://bytepurr.purrquinox.com/kirky/abcd1234/photo.jpg" }
```

### Example

```bash
curl -X POST "https://api.kirky.app/images/upload?directory=PostImage" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@photo.jpg"
```

### Errors

| Status | Description                    |
|--------|--------------------------------|
| `401`  | Missing or invalid token       |
| `502`  | BytePurr rejected the upload   |
| `503`  | Auth service unreachable       |
