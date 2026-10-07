import { useApp } from "../app-context";

export default function Soon({ title }: { title: string }) {
  const { t } = useApp();
  return (
    <section>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <div className="card"><p className="font-semibold">{t("soon.title")}</p><p className="muted">{t("soon.body")}</p></div>
    </section>
  );
}
