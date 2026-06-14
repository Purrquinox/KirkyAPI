const BYTEPURR_URL = "https://bytepurr.purrquinox.com";

export type ImageDirectory = "ProfilePicture" | "BannerImage" | "PostImage";

export async function uploadToBytePurr(
  file: File,
  userId: string,
  directory: ImageDirectory
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BYTEPURR_URL}/upload`, {
    method: "POST",
    headers: {
      "User-ID": userId,
      Platform: "kirky",
      Directory: directory,
    },
    body: formData,
  });

  if (res.status !== 201) throw new Error("Image upload failed");

  const { key } = (await res.json()) as { key: string };
  return `${BYTEPURR_URL}/${key}`;
}
