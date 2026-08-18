import { Layout } from "@/components/layout";
import { IntentSelector } from "@/components/intent-selector";

export default function Create() {
  return (
    <Layout breadcrumbs={[{ label: "만들기", href: "/create" }]}>
      <div className="min-h-full flex flex-col">
        <IntentSelector />
      </div>
    </Layout>
  );
}
