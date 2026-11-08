import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import { RESEND_COOLDOWN_SECONDS } from "@/lib/auth/config";
import { ForgotForm } from "../_components/ForgotForm";

export const metadata: Metadata = { title: `${copy.forgot.title} | ${copy.brand.name}` };

export default function ForgotPage() {
  return (
    <>
      <section className="tile tile--sky">
        <h1 className="auth-title">{copy.forgot.title}</h1>
        <p className="auth-lead">{copy.forgot.lead}</p>
      </section>
      <ForgotForm cooldownSeconds={RESEND_COOLDOWN_SECONDS} />
    </>
  );
}
