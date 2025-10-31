"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        router.push("/login");
        return;
      }
      // On va chercher le profil dans users
      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("id_auth", session.user.id)
        .single();
      if (!user) {
        router.push("/login");
        return;
      }
      // Redirige selon le rôle
      if (user.role === "coach") {
        router.push("/coach");
      } else {
        router.push("/athlete");
      }
    };
    checkUser();
  }, [router]);

  return (
    <main className="flex items-center justify-center min-h-screen">
      <span className="text-blue-700 text-lg font-semibold animate-pulse">
        Chargement...
      </span>
    </main>
  );
}
