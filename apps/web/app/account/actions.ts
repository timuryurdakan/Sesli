"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = formData.get("fullName") as string;
  const instrument = formData.get("instrument") as string;

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, instrument })
    .eq("id", user.id);

  if (error) {
    redirect(`/account?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/account");
  redirect("/account?updated=1");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const response = await fetch(`${apiUrl}/users/me`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!response.ok) {
    redirect("/account?error=Hesap silinemedi, lütfen tekrar deneyin");
  }

  await supabase.auth.signOut();
  redirect("/");
}
