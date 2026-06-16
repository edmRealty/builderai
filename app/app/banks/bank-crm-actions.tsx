"use client";

import { useTransition } from "react";
import { Mail, MessageSquareText, Phone, type LucideIcon } from "lucide-react";

import { recordBankCommunication } from "@/lib/actions/bank-communications";
import { Button } from "@/components/ui/button";

type CommunicationType = "CALL" | "TEXT" | "EMAIL";

type CrmAction = {
  type: CommunicationType;
  label: string;
  icon: LucideIcon;
  href: string | null;
};

type Props = {
  bankId: string;
  phone: string | null;
  email: string | null;
  projectIds: string[];
};

function cleanPhone(phone: string | null) {
  const cleaned = phone?.replace(/[^\d+]/g, "") ?? "";
  return cleaned || null;
}

export function BankCrmActions({ bankId, phone, email, projectIds }: Props) {
  const [pending, startTransition] = useTransition();
  const clean = cleanPhone(phone);
  const actions: CrmAction[] = [
    { type: "CALL", label: "Call", icon: Phone, href: clean ? `tel:${clean}` : null },
    { type: "TEXT", label: "Text", icon: MessageSquareText, href: clean ? `sms:${clean}` : null },
    { type: "EMAIL", label: "Email", icon: Mail, href: email ? `mailto:${email}` : null }
  ];

  function run(action: CrmAction) {
    if (!action.href) return;

    const formData = new FormData();
    formData.set("bankId", bankId);
    formData.set("type", action.type);
    formData.set("returnTo", "/app/banks");
    for (const projectId of projectIds) {
      formData.append("projectIds", projectId);
    }

    startTransition(async () => {
      await recordBankCommunication(formData);
      window.location.href = action.href as string;
    });
  }

  return (
    <div className="flex items-center gap-1">
      {actions.map((action) => {
        const Icon = action.icon;
        const disabled = pending || !action.href;
        return (
          <Button
            aria-label={`${disabled ? "Missing contact info for" : ""} ${action.label}`.trim()}
            className="h-8 w-8 rounded-full px-0"
            disabled={disabled}
            key={action.type}
            onClick={() => run(action)}
            size="sm"
            title={action.href ? action.label : `Add contact info to ${action.label.toLowerCase()}`}
            type="button"
            variant="secondary"
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
