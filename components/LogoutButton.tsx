import { logout } from "@/app/actions/auth";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-faint"
      >
        <LogOut size={14} /> Sair
      </button>
    </form>
  );
}
