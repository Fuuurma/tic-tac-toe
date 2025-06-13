import { cookies } from "next/headers";
import { Color } from "@/app/game/constants/constants";

export async function getUsernameFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const usernameCookie = cookieStore.get("ttt-username");
    return usernameCookie?.value || null;
  } catch (error) {
    console.error("Failed to retrieve username from cookies:", error);
    return null;
  }
}

export async function setUsernameToCookies(username: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set("ttt-username", username, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: "/",
    });
  } catch (error) {
    console.error("Failed to set username in cookies:", error);
  }
}

export async function getColorFromCookies(): Promise<Color | null> {
  try {
    const cookieStore = await cookies();
    const colorCookie = cookieStore.get("ttt-color");
    return (colorCookie?.value as Color) || null;
  } catch (error) {
    console.error("Failed to retrieve color from cookies:", error);
    return null;
  }
}

export async function setColorToCookies(color: Color): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set("ttt-color", color, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: "/",
    });
  } catch (error) {
    console.error("Failed to set color in cookies:", error);
  }
}

export async function clearUserCookies(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("ttt-username");
    cookieStore.delete("ttt-color");
  } catch (error) {
    console.error("Failed to clear user cookies:", error);
  }
}
