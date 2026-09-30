import { workspaceDePagina } from "@/lib/sesion";
import { listDocuments } from "@/lib/data/documents";
import { KnowledgeClient } from "./knowledge-client";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const { workspace } = await workspaceDePagina(workspaceSlug);

  const documents = await listDocuments(workspace.id);
  return (
    <KnowledgeClient workspaceSlug={workspace.slug} initialDocuments={documents} />
  );
}
