import { Browser } from "../components/browser";
import { assets, categories, head, repo, totalBytes } from "../lib/assets";

export default function Page() {
  return (
    <Browser
      assets={assets}
      categories={categories}
      repo={repo}
      head={head}
      totalBytes={totalBytes}
    />
  );
}
