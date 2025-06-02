import { cookies } from "next/headers";

export async function GetUsernameFromCookies() {
  const cookieStore = await cookies();

  const username = cookieStore.get("ttt-username");

  if (!username) return null;

  return username;
}

export async function SetUsernameToCookies(username: string) {
  const cookieStore = await cookies();

  cookieStore.set("ttt-username", username);
}
