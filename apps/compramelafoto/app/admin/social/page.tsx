import { getClfInstagramStatus, listPreviewCandidates, listStoryQueue } from "@/lib/social/album-stories";
import StoriesQueuePanel from "@/components/admin/social/StoriesQueuePanel";
import StoryPreviewSection from "@/components/admin/social/StoryPreviewSection";

export const dynamic = "force-dynamic";

export default async function AdminSocialPage() {
  const [status, queue, candidates] = await Promise.all([
    getClfInstagramStatus(),
    listStoryQueue(),
    listPreviewCandidates(),
  ]);
  return (
    <StoriesQueuePanel
      status={status}
      queue={queue}
      preview={<StoryPreviewSection candidates={candidates} />}
    />
  );
}
