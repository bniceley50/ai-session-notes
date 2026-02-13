import { redirect } from "next/navigation";

/**
 * Home page — immediately redirects to a fresh session workspace.
 *
 * This app is a disposable note generator, not an EHR.
 * There's no sessions list to show; each visit starts fresh.
 */
export default function Home() {
  redirect("/sessions/new");
}

