"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SettingsIcon,
  FileTextIcon,
  WorkflowIcon,
  BotIcon,
  PhoneIcon,
  MessagesSquareIcon,
} from "lucide-react";

export function WorkspaceSidebar({ workspace }: { workspace: string }) {
  const pathname = usePathname();

  const navigation = [
    { name: "General", href: `/${workspace}/settings`, icon: SettingsIcon },
    { name: "Conocimiento", href: `/${workspace}/knowledge`, icon: FileTextIcon },
    { name: "Onboarding", href: `/${workspace}/onboarding`, icon: WorkflowIcon },
    { name: "Chat", href: `/${workspace}/chat`, icon: BotIcon },
    { name: "Conversaciones", href: `/${workspace}/conversations`, icon: MessagesSquareIcon },
    { name: "WhatsApp", href: `/${workspace}/whatsapp`, icon: PhoneIcon },
  ];

  return (
    <aside className="w-64 flex-shrink-0">
      <nav className="space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
