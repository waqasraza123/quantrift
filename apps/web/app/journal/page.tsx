import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/empty-states/empty-state";
import { JournalEntryDetail } from "@/components/journal/JournalEntryDetail";
import { JournalEntryForm } from "@/components/journal/JournalEntryForm";
import { JournalFilters } from "@/components/journal/JournalFilters";
import { JournalEntryList } from "@/components/journal/JournalEntryList";
import { ButtonLink } from "@/components/ui/Button";
import { DisclosurePanel } from "@/components/ui/DisclosurePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { getJournalData } from "@/lib/api/journal";
import { navigationHref } from "@/lib/ui/navigation";

export default async function JournalPage({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getJournalData(params);
  const journalUnavailable = data.failures.some((failure) => failure.label === "Journal entries" && failure.missing);
  const composeHref = `${navigationHref("journal", data.workspace?.id)}${data.workspace ? "&" : "?"}compose=1#new-note`;
  return (
    <AppShell appName={data.appName} workspaceId={data.workspace?.id} workspaceName={data.workspace?.name}>
      <div className="space-y-6">
        <PageHeader eyebrow="Your research, remembered" title="Research journal" description="Capture what you noticed, what you decided, and what would change your view."
          actions={<><ButtonLink href={navigationHref("review", data.workspace?.id)} variant="quiet">Review outcomes</ButtonLink><ButtonLink href={composeHref} variant="primary">Write a note</ButtonLink></>} />
        {!data.workspace ? <EmptyState title="Make room for your research" message="Create a workspace to start saving notes alongside your setups." href="/onboarding" actionLabel="Set up workspace" /> : journalUnavailable ? <EmptyState title="Journal is unavailable" message="Your journal could not be loaded in this environment. You can still review available setups." href={navigationHref("triage", data.workspace.id)} actionLabel="Browse setups" /> : (
          <>
            <div id="new-note" className="scroll-mt-40 xl:scroll-mt-24"><DisclosurePanel title="Write a research note" description="Record an observation or link a note to a setup." open={params.compose === "1" || Boolean(params.signalId) || data.unfilteredEntryCount === 0}><JournalEntryForm data={data} /></DisclosurePanel></div>
            <DisclosurePanel title="Filter your notes" description={`${data.entries.length} of ${data.unfilteredEntryCount} notes in this view.`}><JournalFilters data={data} /></DisclosurePanel>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(280px,.8fr)_minmax(0,1.2fr)]">
              <JournalEntryList entries={data.entries} workspaceId={data.workspace.id} contexts={data.entryContexts} unfilteredEntryCount={data.unfilteredEntryCount} />
              {data.selectedEntry ? <JournalEntryDetail data={data} selectedEntry={data.selectedEntry} /> : <EmptyState title="Choose a note to read" message="Open a saved note to revisit its context and any linked outcomes." />}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
