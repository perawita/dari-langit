import { createFileRoute } from "@tanstack/react-router";
import { LangitTour } from "@/components/langit-tour";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LangitTour />;
}
