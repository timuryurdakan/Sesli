import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchTrack } from "@/lib/player/api";
import { PlayerView } from "@/components/player/PlayerView";

export default async function TrackPlayerPage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/login?redirectTo=/tracks/${trackId}`);
  }

  const track = await fetchTrack(session.access_token, trackId);

  if (!track) {
    notFound();
  }

  return <PlayerView track={track} />;
}
