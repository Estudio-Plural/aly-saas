import { ReactNode } from "react";
import Link from "next/link";
import { SettingsIcon, FileTextIcon, WorkflowIcon, BotIcon } from "lucide-react";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { workspace: string };
}) {
  const navigation = [
    { name: "General", href: `/${params.workspace}/settings`, icon: SettingsIcon },
    { name: "Conocimiento", href: `/${params.workspace}/knowledge`, icon: FileTextIcon },
    { name: "Onboarding", href: `/${params.workspace}/onboarding`, icon: WorkflowIcon },
    { name: "Chat", href: `/${params.workspace}/chat`, icon: BotIcon },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700" />
              <span className="text-xl font-semibold text-neutral-900">Aly SaaS</span>
            </Link>
            <span className="text-neutral-400">/</span>
            <span className="text-neutral-700 font-medium capitalize">
              {params.workspace}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-neutral-700">demo@plural-estudio.co</div>
          </div>
        </div>
      </header>

      {/* Layout con sidebar */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 max-w-4xl">{children}</main>
        </div>
      </div>
    </div>
  );
}
